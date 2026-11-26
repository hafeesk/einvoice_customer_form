def get_context(context):
	# Every visit is per-customer (?ref=...), so never serve a cached page
	context.no_cache = 1
	context.show_sidebar = False
