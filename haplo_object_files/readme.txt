title: Haplo Object Files
module_owner: Jenny
--

This plugin provides functionality for attaching files (as separate store objects with their own metadata) to store objects. It handles: adding a button to the object to be attached to, prefilling any details we know on the new object edit page, listing relevant files on the side of the object.


h3(feature). @haplo:object-files@

Using this feature provides the function @objectFiles@ on the plugin object. You should call this function with a spec object with the following properties:

| @basePath@ | The base path of the using plugin, e.g @"/do/hres-funding-files"@ |
| @objectTypes@ | An array of the types of objects to be attached to |
| @objectAttribute@ | If there should be an attribute on the file that links to the object, specify what attribute that is. Optional, in case you are doing something more complicated (like "@hres_funding_files@":/funding/hres_funding_files does), but recommended. |
| @parentType@ | You should create a new type for files attached to a particular set of objects. Create subtypes for different categories of file. For this, you should provide the parent type. |
| @defaultType@ | If one of the sub-types should be the default, specify that. (optional) |
| @updateTemplateObject@ | A function, taking @templateObject@ and @object@. Update the @templateObject@ with any information from the @object@ that should be set by default on the store object for the new file (optional) |
| @readOnlyAttributes@ | If some attributes on the file store object should be read only when creating it, specify those here. (optional) |
| @elementName@ | A unique name for the element that will display the list of files attached to the object. For creating the element that is displayed on the side. You will need to add the element @haplo_object_files:<elementName>@ to the relevant types for this to be displayed |
| @elementTitle@ | A title for the element |
| @elementView@ | A function taking L, for adding to the element view. It is recommended that this isn't used unless absolutely necessary. The standard view should be enough for most use cases. |


h3(action). @hres:action:object-files:can-create-any-file@

This action will allow the user to create any type of object file. Use with care.