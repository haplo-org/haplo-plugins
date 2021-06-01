title: Alternative Versions
--

This plugin provides the UI and functionality behind allowing multiple versions of an object to exist and be marked as alternative versions. Alternative versions aren't indexed so they don't appear as duplicate entries in a search and also won't appear in store queries. This functionality and linking of versions is provided by marking one object as the 'Authoritative version' that is the version of record in the system, which all alternative versions should link to.

h2. Services

h3(service). "haplo_alternative_versions:for_object"

Returns a StoreQueryResults object of all alternative versions of the provided StoreObject (optionally including archived objects). This is done by searching for objects linked to the authoritative version, as the alternative versions are all linked to the authoritative version the fact they aren't indexed in the system doesn't matter.

Arguments:

|@object@|The StoreObject to search for alternative versions for|
|@includeArchivedObjects@|(Optional) Boolean to decide whether archived objects should be included in the query|

h3(service). "haplo_alternative_versions:copy_data_from_alternative_to_other"

Copies attribute values from one object (@alternativeVersion@) to another (@other@). There is an optional @keepAdditionalAttributes@ parameter which allows for the @other@ object to keep any attribute/qualifier combinations which aren't present on the @alternativeVersion@)

Arguments:

|@alternativeVersion@|The StoreObject to copy values from|
|@other@|The StoreObject to copy the values on to|
|@keepAdditionalAttributes@|(Optional) Boolean to decide whether or not to keep any additional attribute on @other@ or whether to make it a hard copy of @alternativeVersion@|

h3(service). "haplo_alternative_versions:copy_data_to_authoritative"

Similar to above however this only takes a single argument @alternativeVersion@ and copies the data from it onto the associated authoritative version (if there isn't an authoritative this will create one and link it to @alternativeVersion@).

There is also a service call to the service @"haplo_alternative_versions:update_replacement_object"@ (below) which allows for the object to be updated to be swapped entirely, so that the data from @alternativeVersion@ will be copied onto this replaced object

Arguments:

|@alternativeVersion@|The StoreObject to copy the data from|

h3(service). "haplo_alternative_versions:source_for_alternative_object"

Service to be implemented to allow for alternative versions to be mapped to a source, convention is that each use case for alternative versions will label the alternative versions that use case is applicable to with a @Label@ and this is used to determine what to display. Expected return is a JS object.

Expected return object's keys:

|@source@|A unique identifier for the source which is the same as name provided in the metadata for the service registry entry|
|@identifier@|A unique identifier which identifies the alternative object within the system, usually the ref of the object or if this is a version created with data from an outside source such as a feed this could be used to identify the object within the outside source so that future versions may update it.|
|@name@|The display name of the source|

Arguments: 

|@alternativeVersion@|The StoreObject to obtain a source for|

h3(service). "haplo_alternative_versions:update_replacement_object"

Implement this service to change the object to have the @alternativeVersion@ data copied onto in "haplo_alternative_versions:copy_data_to_authoritative".

Arguments:

|@source@|The source of the alternative object (same as the @source@ key from @"haplo_alternative_versions:source_for_alternative_object"@|
|@currentUser@|The user currently performing the copy to the authoritative version|
|@auth@|The authoritative version to potentially replace|

Expected return: A @StoreObjectMutable@ to copy the data from the previously provided @alternativeVersion@ onto

h3(service). "haplo_alternative_versions:update_database_information"

Service to be implemented to allow database information to be updated when an object has been updated with data from an @alternativeVersion@.

Arguments:

|@alternativeVersion@|The alternative version that has just had data copied from|
|@updated@|The updated object|

h3(service). "haplo_alternative_versions:notify:updated_object"

Service to be implemented if some action must be taken when an object has been updated.

Arguments:

|@updated@|The object that has just been updated|

h3(service). "haplo_alternative_versions:changed_attributes"

Service which takes an alternative version and returns an array of attribute descs which have values that differ between the provided alternative version and its associated authoritative version. Returns an empty array if there is no associated authoritative version.

Arguments:

|@alternative@|The alternative version to return the attributes that differ from the associated authoritative version|