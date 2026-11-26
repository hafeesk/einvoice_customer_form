/* UAE e-Invoicing — Customer Master Data Form (guest web form) */
/* Frappe v14: this file is injected after web_form.bundle.js, whose frappe.ready
   handler builds the form first, so wait for frappe.web_form instead of after_load. */
frappe.ready(function () {
	let tries = 0;
	(function wait() {
		const w = frappe.web_form;
		if (w && w.fields_dict && w.fields_dict.legal_name) return init(w);
		if (tries++ < 100) setTimeout(wait, 50);
	})();
});

function init(wf) {
	const key = new URLSearchParams(window.location.search).get("ref") || "";
	const ALLOWED = ["pdf", "jpg", "jpeg", "png"];
	const SECTIONS = [
		{ fn: "sec_company", label: __("Company & registration"), sub: __("As shown on your trade licence or cabinet decision."),
			req: ["legal_name", "registration_type", "issuing_authority", "tl_cd_number", "tin", "peppol_participant_id"] },
		{ fn: "sec_address", label: __("Registered address"), sub: __("The address on your trade licence or tax registration."),
			req: ["building_name", "street", "area", "emirate", "country"] },
		{ fn: "sec_contact", label: __("Contact details"), sub: __("Who we should contact about e-Invoicing."),
			req: ["contact_person", "email_id", "mobile_no"] },
		{ fn: "sec_golive", label: __("e-Invoicing go-live"), sub: __("Your Accredited Service Provider and planned go-live."),
			req: ["asp_status", "expected_go_live_date"] },
		{ fn: "sec_attachments", label: __("Attachments"), sub: __("Please attach clear copies of the following. PDF, JPG or PNG, up to 10 MB each."),
			req: ["trade_license_attachment", "trc_attachment"] },
		{ fn: "sec_declaration", label: __("Declaration"), sub: "",
			req: ["agree_declaration"] },
	];
	let info = { company: {} };

	document.body.classList.add("eicm-page"); // styles: e_invoicing.css (auto-loaded by Frappe)

	const esc = (s) => frappe.utils.escape_html(s == null ? "" : String(s));
	const field = (fn) => wf.fields_dict[fn];
	const sectionEl = (fn) => {
		const s = wf.fields_dict[fn]; // v14: section objects live in fields_dict
		return s && s.wrapper ? $(s.wrapper).closest(".form-section") : $();
	};
	const fileName = (v) => (v || "").split(",data:")[0].split("?")[0];

	// Attach control merges df.options into the uploader: restrict types and size
	["trade_license_attachment", "trc_attachment"].forEach((fn) => {
		const f = field(fn);
		if (!f) return;
		f.df.options = Object.assign({}, typeof f.df.options === "object" ? f.df.options : {}, {
			disable_file_browser: true,
			restrictions: { allowed_file_types: [".pdf", ".jpg", ".jpeg", ".png"], max_file_size: 10 * 1024 * 1024 },
		});
	});

	frappe
			.call({ method: "einvoice_customer_form.api.get_link_info", args: { key }, type: "GET" })
			.then((r) => {
				info = r.message || { valid: false, company: {} };
				if (!info.valid) return render_invalid();
				wf.set_value("ref", key);
				Object.entries(info.prefill || {}).forEach(([k, v]) => {
					if (field(k) && !wf.get_value(k)) wf.set_value(k, v);
				});
				build_layout();
				toggle_country();
				update_progress();
			});

	// ---------- field behaviour ----------
	wf.on("tin", (f, value) => {
		const tin = (value || "").replace(/\D/g, "").slice(0, 10);
		if (tin.length === 10) wf.set_value("peppol_participant_id", "0235:" + tin);
	});
	wf.on("trn", (f, value) => {
		const trn = (value || "").replace(/\D/g, "");
		if (trn.length === 15 && !wf.get_value("tin")) wf.set_value("tin", trn.slice(0, 10));
	});
	wf.on("emirate", () => toggle_country());
	["trade_license_attachment", "trc_attachment"].forEach((fn) =>
		wf.on(fn, (f, value) => {
			if (!value) return;
			const ext = fileName(value).split(".").pop().toLowerCase();
			if (!ALLOWED.includes(ext)) {
				wf.set_value(fn, "");
				frappe.msgprint(__("Only PDF, JPG or PNG files are accepted."));
			}
		})
	);

	function toggle_country() {
		const outside = wf.get_value("emirate") === "Outside UAE";
		const f = field("country");
		if (!f) return;
		if (!outside) wf.set_value("country", "United Arab Emirates");
		else if (wf.get_value("country") === "United Arab Emirates") wf.set_value("country", "");
		$(f.input || f.$input).prop("readonly", !outside);
	}

	wf.validate = () => {
		const v = wf.get_values(true) || {};
		const errors = [];
		if (!/^\d{10}$/.test((v.tin || "").trim())) errors.push(__("TIN must be exactly 10 digits."));
		if (v.trn && !/^\d{15}$/.test(v.trn.replace(/\s/g, ""))) errors.push(__("TRN must be exactly 15 digits."));
		if (!/^0235:\d{10}$/.test((v.peppol_participant_id || "").trim()))
			errors.push(__("Peppol Participant ID must look like 0235:1000011930."));
		if (!/^\+\d{8,15}$/.test((v.mobile_no || "").replace(/[\s\-()]/g, "")))
			errors.push(__("Enter the mobile number with the country code, e.g. +971 50 123 4567."));
		if (!v.agree_declaration) errors.push(__("Please tick the declaration."));
		if (errors.length) {
			frappe.msgprint({ title: __("Please check the form"), message: errors.join("<br>"), indicator: "red" });
			return false;
		}
		return true;
	};

	// ---------- layout ----------
	function build_layout() {
		const c = info.company || {};
		const $form = $(".web-form").first();
		const $head = $(".web-form-head, .web-form-header").first();

		// hero
		const pills = [
			c.submit_by ? `<span class="eicm-pill">📅 ${__("Please submit by")} <b>${esc(c.submit_by)}</b></span>` : "",
			`<span class="eicm-pill">⏱ ${__("About 5 minutes")}</span>`,
			`<span class="eicm-pill">📄 ${__("2 documents · PDF, JPG or PNG")}</span>`,
		].join("");
		const $hero = $(`
			<div class="eicm-hero"><div class="eicm-hero-inner">
				${c.logo ? `<div class="eicm-logo"><img src="${esc(c.logo)}" alt=""></div>` : ""}
				<div>
					<div class="eicm-company">${esc(c.name)}</div>
					<h1>${__("UAE e-Invoicing — Customer Master Data Form")}</h1>
					<p>${__("Please complete all fields below and attach the required documents. This information is used to set up your organisation in our e-Invoicing master data under the UAE e-Invoicing framework (UAE Ministry of Finance / Federal Tax Authority), so that invoices can be exchanged and routed correctly.")}</p>
					<div class="eicm-pills">${pills}</div>
				</div>
			</div></div>`);
		$head.hide();
		const $container = $(".web-form-container").first();
		($container.length ? $container : $form).before($hero);

		// two-column shell
		const $shell = $(`<div class="eicm-shell"><aside class="eicm-aside"></aside><main class="eicm-main"></main></div>`);
		$form.before($shell);
		$shell.find(".eicm-main").append($form);

		// sidebar
		const nav = SECTIONS.map((s, i) =>
			`<a class="eicm-nav" data-sec="${s.fn}" href="#"><span class="eicm-num">${i + 1}</span>${s.label}</a>`).join("");
		const details = c.name ? `
			<div class="eicm-card eicm-details">
				<h6>${__("Our details, for your records")}</h6>
				<label>${__("Entity")}</label><div>${esc(c.name)}</div>
				${c.tin ? `<label>TIN</label><div>${esc(c.tin)}</div>` : ""}
				${c.trn ? `<label>TRN</label><div>${esc(c.trn)}</div>` : ""}
				${c.peppol ? `<label>${__("Peppol Participant ID")}</label><div>${esc(c.peppol)}</div>` : ""}
			</div>` : "";
		const help = c.support_email ? `
			<div class="eicm-card eicm-help">
				<h6>${__("Need help?")}</h6>
				<p>${__("E-mail")} <a href="mailto:${esc(c.support_email)}">${esc(c.support_email)}</a> ${__("and we will get back to you.")}</p>
			</div>` : "";
		$shell.find(".eicm-aside").html(`
			<div class="eicm-card eicm-progress">
				<div class="eicm-bar"><span></span></div>
				<div class="eicm-count"></div>
				${nav}
			</div>${details}${help}`);
		$shell.on("click", ".eicm-nav", function (e) {
			e.preventDefault();
			const $s = sectionEl($(this).data("sec"));
			if ($s.length) window.scrollTo({ top: $s.offset().top - 20, behavior: "smooth" });
		});

		// previous submission banner
		if (info.last_submitted) {
			$form.before(`<div class="eicm-banner">ℹ️ ${__("We received a form from you on <b>{0}</b> (UAE time). Fill this one in only if something changed: we keep every form you send.", [esc(info.last_submitted)])}</div>`);
		}

		// section cards with numbers + subtitles
		$form.find(".form-section").addClass("eicm-cont");
		SECTIONS.forEach((s, i) => {
			const $s = sectionEl(s.fn);
			if (!$s.length) return;
			$s.removeClass("eicm-cont").addClass("eicm-section").attr("data-sec", s.fn);
			const $h = $s.find(".section-head").first();
			const title = $h.text().trim() || s.label;
			$h.html(`<span class="eicm-badge">${i + 1}</span><div><div class="eicm-title">${esc(title)}</div>${s.sub ? `<div class="eicm-sub">${s.sub}</div>` : ""}</div>`)
				.addClass("eicm-head").removeClass("collapsible collapsed");
		});

		// declaration text above the checkbox
		const decl = __("I confirm that the information provided in this form is accurate, complete and current; that I am authorised to submit it on behalf of the organisation named above; and that I will notify {0} of any changes to our tax registration number or business details that may affect e-Invoicing.", [esc(c.name || __("us"))]);
		const agree = field("agree_declaration");
		if (agree) $(agree.wrapper || agree.$wrapper).before(`<div class="eicm-decl">${decl}</div>`);

		// registration type as two cards
		build_reg_cards();

		// footer note beside the submit button
		const $btn = $(".web-form-footer .btn-primary, .web-form .submit-btn").first();
		if ($btn.length && !$(".eicm-foot-note").length)
			$btn.after(`<span class="eicm-foot-note">${__("If your details change afterwards, you can send an updated form through the same link: we keep every form you send.")}</span>`);

		$form.on("change input", "input, select, textarea", () => setTimeout(update_progress, 50));
		$(document).on("click", ".eicm-regcard", () => setTimeout(update_progress, 50));
		setInterval(update_progress, 1500); // catches file uploads
	}

	function build_reg_cards() {
		const f = field("registration_type");
		if (!f) return;
		const $w = $(f.wrapper || f.$wrapper);
		const cards = [
			["Trade License (TL)", __("Issued by an economic department or a free zone authority")],
			["Cabinet Decision (CD)", __("Established by a cabinet decision")],
		];
		const $cards = $(`<div class="eicm-regcards">${cards.map(([v, d]) =>
			`<div class="eicm-regcard" data-value="${esc(v)}"><span class="eicm-radio"></span><div><b>${esc(v)}</b><small>${d}</small></div></div>`).join("")}</div>`);
		$w.find(".control-input-wrapper, .control-input").first().hide();
		$w.find(".control-label").first().append(` <span class="eicm-muted">(${__("tick one")})</span>`);
		$w.append($cards);
		const sync = () => $cards.find(".eicm-regcard").each(function () {
			$(this).toggleClass("active", $(this).data("value") === wf.get_value("registration_type"));
		});
		$cards.on("click", ".eicm-regcard", function () {
			wf.set_value("registration_type", $(this).data("value")).then(sync);
		});
		sync();
	}

	function update_progress() {
		let done = 0;
		SECTIONS.forEach((s) => {
			const ok = s.req.every((fn) => {
				const v = wf.get_value(fn);
				return fn === "agree_declaration" ? !!v : v !== undefined && v !== null && String(v).trim() !== "";
			});
			if (ok) done++;
			$(`.eicm-nav[data-sec="${s.fn}"]`).toggleClass("done", ok);
		});
		$(".eicm-bar span").css("width", (done / SECTIONS.length) * 100 + "%");
		$(".eicm-count").html(`<b>${done} ${__("of")} ${SECTIONS.length}</b> ${__("sections complete")}`);
	}

	function render_invalid() {
		const c = info.company || {};
		$(".web-form-head, .web-form-header").hide();
		$(".web-form").first().replaceWith(`
			<div class="eicm-invalid eicm-card">
				${c.logo ? `<img src="${esc(c.logo)}" alt="" class="eicm-invalid-logo">` : ""}
				<div class="eicm-muted">${__("Secure form")}</div>
				<h2>${__("UAE e-Invoicing — Customer Master Data Form")}</h2>
				<h4>${__("This link is not valid.")}</h4>
				<p>${__("Open the form using the link in the email you received. If it doesn't open, copy the entire link from the email into your browser's address bar.")}</p>
				${c.support_email ? `<p>${__("If the problem continues, email")} <a href="mailto:${esc(c.support_email)}">${esc(c.support_email)}</a>.</p>` : ""}
			</div>`);
	}
}
