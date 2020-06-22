title: Publication replaceable templates
--

These allow you to replace the HSVT for a template in your client code, but still use common features for functionality. The common functionality will pass a JS view object into your template, which must accept the same view varibles and have the same blocks as the template you're replacing.

h3. Primary button link

The template for primary buttons within the publication.

|Blocks|(anonymous block) -- contents of button |
| View | href -- link for button |


h4. Example

<pre>
std:web-publisher:template("haplo:publication-common:ui:button:primary")
   { "File access - " title }
</pre>

h3. Secondary button link

|Blocks|(anonymous block) -- contents of button|
|View|href -- link for button|


h4. Example

<pre>
std:web-publisher:template("haplo:publication-common:ui:button:secondary")
  { "File access - " title }
</pre>

h3. Generic panel

|Blocks|(anonymous block) -- contents of panel|
||heading -- heading of panel|


h4. Example

<pre>
std:web-publisher:template("haplo:publication-common:ui:panel")
  { "Panel contents" }
  heading { "Panel heading" }
</pre>