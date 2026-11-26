frappe.ui.form.on("E-Invoicing Customer Master", {
	refresh(frm) {
		if (frm.is_new() || !frm.doc.customer) return;
		frm.add_custom_button(__("Apply to Customer"), () => {
			frappe.confirm(
				__("Update {0} with this TRN, address and contact?", [frm.doc.customer]),
				() => frm.call("apply_to_customer").then((r) => {
					frappe.show_alert({ message: __("Customer, address and contact updated"), indicator: "green" });
					frm.reload_doc();
				})
			);
		});
		if (frm.doc.status === "New") {
			frm.add_custom_button(__("Mark Reviewed"), () => frm.set_value("status", "Reviewed").then(() => frm.save()), __("Status"));
			frm.add_custom_button(__("Reject"), () => frm.set_value("status", "Rejected").then(() => frm.save()), __("Status"));
		}
	},
});
