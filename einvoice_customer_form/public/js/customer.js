frappe.ui.form.on("Customer", {
	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(__("e-Invoicing Form Link"), () => show_link(frm), __("Actions"));
		frm.add_custom_button(__("e-Invoicing Submissions"), () =>
			frappe.set_route("List", "E-Invoicing Customer Master", { customer: frm.doc.name }), __("View"));
	},
});

function show_link(frm, regenerate = 0) {
	frappe
		.xcall("einvoice_customer_form.api.get_form_link", { customer: frm.doc.name, regenerate })
		.then((url) => {
			frm.reload_doc();
			const d = new frappe.ui.Dialog({
				title: __("e-Invoicing form link"),
				fields: [
					{ fieldtype: "Data", fieldname: "url", label: __("Private link for {0}", [frm.doc.customer_name]), default: url, read_only: 1 },
					{ fieldtype: "HTML", options: `<p class="text-muted small">${__("Anyone with this link can submit data for this customer. Regenerate it to cancel the old link.")}</p>` },
				],
				primary_action_label: __("Copy"),
				primary_action() {
					frappe.utils.copy_to_clipboard(url);
					d.hide();
				},
				secondary_action_label: __("Email to customer"),
				secondary_action() {
					d.hide();
					new frappe.views.CommunicationComposer({
						doc: frm.doc,
						frm,
						subject: __("UAE e-Invoicing — Customer Master Data Form"),
						recipients: frm.doc.email_id || "",
						message: `<p>${__("Dear Customer,")}</p>
<p>${__("To set up your organisation for UAE e-Invoicing, please complete our customer master data form and attach your Trade License and Tax Registration Certificate:")}</p>
<p><a href="${url}">${url}</a></p>
<p>${__("It takes about 5 minutes.")}</p>`,
					});
				},
			});
			d.add_custom_action(__("Regenerate link"), () => {
				d.hide();
				frappe.confirm(__("The current link will stop working. Continue?"), () => show_link(frm, 1));
			});
			d.show();
		});
}
