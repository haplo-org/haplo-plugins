title: Public information page
--

Your plugin should use @"haplo:public_information_page"@.

Then call @P.definePublicInformationPage(spec)@ where @spec@ has properties:
* name - URL compatible name of page
* title - title of page
* editAction - Action to control editing
* form - (optional) custom P.form to be used in place of the default

This returns an object, call @publicUrl()@ and @editUrl()@ to get paths of the public and edit pages.
