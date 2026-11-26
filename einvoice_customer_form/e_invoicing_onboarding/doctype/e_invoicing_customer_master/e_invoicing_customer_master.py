import os
import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, validate_email_address

ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_BYTES = 10 * 1024 * 1024
ATTACH_FIELDS = ("trade_license_attachment", "trc_attachment")


class EInvoicingCustomerMaster(Document):
	def before_insert(self):
		self.submitted_on = now_datetime()
		self.status = "New"
		if getattr(frappe.local, "request_ip", None):
			self.submitted_ip = frappe.local.request_ip
		self.resolve_customer()

	def validate(self):
		self.validate_customer()
		self.clean_values()
		self.validate_ids()
		self.validate_address()
		self.validate_contact()
		self.validate_attachments()
		if not self.agree_declaration:
			frappe.throw(_("Please tick the declaration before submitting."))

	# ------------------------------------------------------------------
	def resolve_customer(self):
		"""The customer always comes from the secret ref token, never from browser input."""
		if frappe.session.user == "Guest" or self.ref:
			self.customer = frappe.db.get_value("Customer", {"einvoice_ref": self.ref}, "name") if self.ref else None

	def validate_customer(self):
		if frappe.session.user == "Guest" and not self.customer:
			frappe.throw(_("This link is not valid. Please open the form using the link in your email."),
				frappe.PermissionError)

	def clean_values(self):
		for f in ("tin", "trn", "tl_cd_number", "peppol_participant_id"):
			if self.get(f):
				self.set(f, re.sub(r"\s+", "", self.get(f)))
		if self.mobile_no:
			self.mobile_no = re.sub(r"[\s\-()]", "", self.mobile_no)
		if self.emirate and self.emirate != "Outside UAE":
			self.country = "United Arab Emirates"
		if self.asp_status == "No":
			self.asp_name = None

	def validate_ids(self):
		if not re.fullmatch(r"\d{10}", self.tin or ""):
			frappe.throw(_("TIN must be exactly 10 digits."))
		if self.trn:
			if not re.fullmatch(r"\d{15}", self.trn):
				frappe.throw(_("TRN must be exactly 15 digits."))
			if not self.trn.startswith(self.tin):
				frappe.throw(_("TIN should be the first 10 digits of your TRN."))
		if not self.peppol_participant_id:
			self.peppol_participant_id = f"0235:{self.tin}"
		if not re.fullmatch(r"0235:\d{10}", self.peppol_participant_id):
			frappe.throw(_("Peppol Participant ID must be in the format 0235:TIN, e.g. 0235:1000011930."))

	def validate_address(self):
		if self.emirate == "Outside UAE" and (self.country or "").strip().lower() in ("", "united arab emirates", "uae"):
			frappe.throw(_("Please enter the country, since you chose Outside UAE."))

	def validate_contact(self):
		validate_email_address(self.email_id, throw=True)
		if not re.fullmatch(r"\+\d{8,15}", self.mobile_no or ""):
			frappe.throw(_("Please enter the mobile number with the country code, e.g. +971 50 123 4567."))

	def validate_attachments(self):
		# Web forms (v14) insert the doc first with empty Attach fields, then save the
		# uploaded files and save again: only check files once they are real File URLs.
		first_web_form_insert = self.is_new() and frappe.flags.in_web_form
		for field in ATTACH_FIELDS:
			url = self.get(field)
			label = self.meta.get_label(field)
			if not url:
				if first_web_form_insert:
					continue
				frappe.throw(_("Please attach: {0}").format(label))
			if url.startswith("data:") or ",data:" in url:
				continue
			ext = os.path.splitext(url.split("?")[0])[1].lower()
			if ext not in ALLOWED_EXT:
				frappe.throw(_("{0}: only PDF, JPG or PNG files are accepted.").format(label))
			size = frappe.db.get_value("File", {"file_url": url}, "file_size")
			if size and int(size) > MAX_FILE_BYTES:
				frappe.throw(_("{0}: the file is larger than 10 MB.").format(label))

	# ------------------------------------------------------------------
	@frappe.whitelist()
	def apply_to_customer(self):
		"""Copy the submitted data onto the Customer, its billing Address and Contact."""
		frappe.only_for(("System Manager", "Accounts Manager", "Sales Manager"))
		if not self.customer:
			frappe.throw(_("No customer is linked to this form."))

		cust = frappe.get_doc("Customer", self.customer)
		if self.trn:
			cust.tax_id = self.trn
		cust.einvoice_tin = self.tin
		cust.einvoice_peppol_id = self.peppol_participant_id
		cust.save()

		country = self.country if frappe.db.exists("Country", self.country) else "United Arab Emirates"
		addr_name = frappe.db.get_value("Dynamic Link",
			{"link_doctype": "Customer", "link_name": cust.name, "parenttype": "Address"}, "parent")
		addr = frappe.get_doc("Address", addr_name) if addr_name else frappe.new_doc("Address")
		addr.update({
			"address_title": self.legal_name,
			"address_type": "Billing",
			"address_line1": self.building_name,
			"address_line2": self.street,
			"city": self.area or self.emirate,
			"state": self.emirate if self.emirate != "Outside UAE" else None,
			"country": country,
			"email_id": self.email_id,
			"phone": self.mobile_no,
			"is_primary_address": 1,
		})
		if not addr_name:
			addr.append("links", {"link_doctype": "Customer", "link_name": cust.name})
		addr.save()

		contact_name = frappe.db.get_value("Contact Email", {"email_id": self.email_id}, "parent")
		contact = frappe.get_doc("Contact", contact_name) if contact_name else frappe.new_doc("Contact")
		if not contact_name:
			contact.first_name = self.contact_person
			contact.add_email(self.email_id, is_primary=1)
			contact.add_phone(self.mobile_no, is_primary_mobile_no=1)
		if not any(l.link_doctype == "Customer" and l.link_name == cust.name for l in contact.links):
			contact.append("links", {"link_doctype": "Customer", "link_name": cust.name})
		contact.save()

		self.db_set("status", "Applied")
		return {"customer": cust.name, "address": addr.name, "contact": contact.name}
