from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Customer": [
		{
			"fieldname": "einvoice_section", "fieldtype": "Section Break",
			"label": "UAE e-Invoicing", "insert_after": "tax_id", "collapsible": 1,
		},
		{"fieldname": "einvoice_tin", "fieldtype": "Data", "label": "TIN", "insert_after": "einvoice_section"},
		{"fieldname": "einvoice_peppol_id", "fieldtype": "Data", "label": "Peppol Participant ID", "insert_after": "einvoice_tin"},
		{"fieldname": "einvoice_col", "fieldtype": "Column Break", "insert_after": "einvoice_peppol_id"},
		{
			"fieldname": "einvoice_ref", "fieldtype": "Data", "label": "e-Invoicing Form Token",
			"insert_after": "einvoice_col", "read_only": 1, "unique": 1, "no_copy": 1,
			"print_hide": 1, "search_index": 1,
		},
	]
}


def after_install():
	create_custom_fields(CUSTOM_FIELDS, update=True)
