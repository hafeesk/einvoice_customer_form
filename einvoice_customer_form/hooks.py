app_name = "einvoice_customer_form"
app_title = "e-Invoicing Customer Form"
app_publisher = "Your Company"
app_description = "UAE e-Invoicing customer master data web form"
app_email = "admin@example.com"
app_license = "mit"

required_apps = ["erpnext"]

after_install = "einvoice_customer_form.install.after_install"
after_migrate = "einvoice_customer_form.install.after_install"

doctype_js = {"Customer": "public/js/customer.js"}
