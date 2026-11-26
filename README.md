# e-Invoicing Customer Form — Frappe / ERPNext v14

A guest web form that copies the "UAE e-Invoicing — Customer Master Data Form" layout: 6 numbered sections,
a progress sidebar, an "Our details" panel, a previous-submission banner, TL/CD cards, upload boxes and a declaration.
Each customer gets a private link: `/e-invoicing/new?ref=<token>`. The token is stored on the Customer, and the
Customer on a submission is always resolved on the server from that token.

Requires Frappe v14 and ERPNext v14 (Python 3.10+).

## Install
```bash
cd ~/frappe-bench
bench get-app /path/to/einvoice_customer_form      # or unzip into apps/ and: bench pip install -e apps/einvoice_customer_form
bench --site yoursite install-app einvoice_customer_form
bench --site yoursite migrate && bench --site yoursite clear-cache
```
You don't need `bench build`, because the web form's CSS and JS sit next to its JSON and Frappe loads them inline.

## Configure
1. **System Settings → Allow Guests to Upload Files**: switch it on, otherwise guests can't attach documents.
2. Set **Company → Tax ID** to your 15-digit TRN. The sidebar works out TIN (first 10 digits) and Peppol `0235:TIN` from it.
3. Set a logo in **Website Settings → App Logo**.
4. Optional `site_config.json` keys:
   ```json
   { "einvoice_company": "Freightworks Logistics LLC",
     "einvoice_support_email": "einvoicing.support@yourdomain.com",
     "einvoice_submit_by": "2026-11-30" }
   ```

## Use
- On a **Customer**, go to Actions → **e-Invoicing Form Link**, then copy the link or email it. If you regenerate the link, the old one stops working.
- Every submission is kept in **E-Invoicing Customer Master**. Customer → View → **e-Invoicing Submissions** lists them.
- On a submission, click **Apply to Customer**. This writes the TRN, TIN and Peppol ID and creates or updates the billing Address and Contact.
- A wrong or old link shows the "This link is not valid" page.

## Validation (server side)
- A guest submission must carry a valid token.
- TIN must be 10 digits. TRN must be 15 digits and start with the TIN. Peppol must be `0235:` followed by 10 digits.
- The email must be valid, and the mobile number must be in `+<country code>…` format. The declaration must be ticked.
- Attachments must be PDF, JPG or PNG and no larger than 10 MB. This is checked after the web form turns the uploads into File records.
- `get_link_info` is rate-limited to 30 calls a minute.

## Coexistence with einvoice_erpgulf
This app only collects and stores the customer's data. It doesn't change anything in einvoice_erpgulf. If that app keeps the
Peppol ID or TIN in its own Customer fields, map them in `apply_to_customer()`.
