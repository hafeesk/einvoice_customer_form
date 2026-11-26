from setuptools import find_packages, setup

with open("requirements.txt") as f:
	install_requires = [line.strip() for line in f if line.strip() and not line.startswith("#")]

# get version from __version__ variable in einvoice_customer_form/__init__.py
from einvoice_customer_form import __version__ as version

setup(
	name="einvoice_customer_form",
	version=version,
	description="UAE e-Invoicing customer master data web form for ERPNext",
	author="Your Company",
	author_email="admin@example.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires,
)
