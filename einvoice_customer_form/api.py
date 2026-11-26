import secrets

import frappe
from frappe.rate_limiter import rate_limit
from frappe.utils import format_datetime, formatdate, get_url

DT = "E-Invoicing Customer Master"
WEB_FORM = "e-invoicing"
PREFILL_FIELDS = (
	"legal_name", "registration_type", "issuing_authority", "tl_cd_number", "tin", "trn",
	"peppol_participant_id", "building_name", "street", "area", "emirate", "country",
	"contact_person", "email_id", "mobile_no", "asp_status", "asp_name", "expected_go_live_date",
)


def _company_details():
	"""'Our details' panel: site_config `einvoice_company`, else the default company."""
	company = frappe.conf.get("einvoice_company") or frappe.defaults.get_global_default("company")
	if not company:
		return {}
	c = frappe.db.get_value("Company", company, ["company_name", "tax_id", "email"], as_dict=True) or {}
	trn = (c.get("tax_id") or "").replace(" ", "")
	tin = trn[:10] if len(trn) >= 10 else ""
	submit_by = frappe.conf.get("einvoice_submit_by")
	return {
		"name": c.get("company_name") or company,
		"trn": trn,
		"tin": tin,
		"peppol": f"0235:{tin}" if tin else "",
		"logo": frappe.db.get_single_value("Website Settings", "app_logo") or "",
		"support_email": frappe.conf.get("einvoice_support_email") or c.get("email") or "",
		"submit_by": formatdate(submit_by, "d MMMM yyyy") if submit_by else "",
	}


def _customer_from_key(key):
	if not key or not isinstance(key, str):
		return None
	return frappe.db.get_value("Customer", {"einvoice_ref": key}, "name")


@frappe.whitelist(allow_guest=True, methods=["GET", "POST"])
@rate_limit(limit=30, seconds=60)
def get_link_info(key=None):
	"""Sidebar details, previous-submission banner and prefill for a request key."""
	company = _company_details()
	customer_name = _customer_from_key(key)
	customer = frappe.db.get_value("Customer", customer_name, ["name", "customer_name", "tax_id"], as_dict=True) if customer_name else None
	if not customer:
		return {"valid": False, "company": company}

	last = frappe.get_all(DT, filters={"customer": customer.name}, fields=["name", "submitted_on"],
		order_by="creation desc", limit=1)
	last_submitted = None
	if last:
		last_submitted = format_datetime(last[0].submitted_on, "d MMMM yyyy 'at' HH:mm")
		prefill = frappe.db.get_value(DT, last[0].name, PREFILL_FIELDS, as_dict=True) or {}
		if prefill.get("expected_go_live_date"):
			prefill["expected_go_live_date"] = str(prefill["expected_go_live_date"])
	else:
		trn = (customer.tax_id or "").replace(" ", "")
		prefill = {"legal_name": customer.customer_name}
		if len(trn) == 15 and trn.isdigit():
			prefill.update({"trn": trn, "tin": trn[:10], "peppol_participant_id": f"0235:{trn[:10]}"})

	return {
		"valid": True,
		"company": company,
		"customer_name": customer.customer_name,
		"last_submitted": last_submitted,
		"prefill": {k: v for k, v in prefill.items() if v},
	}


@frappe.whitelist(methods=["POST"])
def get_form_link(customer, regenerate=0):
	"""Return (creating if needed) the customer's private form link."""
	frappe.has_permission("Customer", "write", customer, throw=True)
	key = frappe.db.get_value("Customer", customer, "einvoice_ref")
	if not key or int(regenerate):
		key = secrets.token_urlsafe(32)
		frappe.db.set_value("Customer", customer, "einvoice_ref", key)
	return get_url(f"/{WEB_FORM}/new?ref={key}")
