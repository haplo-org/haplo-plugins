title: Haplo service registry
--

Provides a composible method of grouping services from different places in the system. Services are described with metadata, which is then exposted to consumers of the @haplo:services-registry:query@ to select on.

Think of it as a discovery pattern for services.


h2. Service metadata

<pre>language=javascript
{
    "hres:repository:dc:write-store-object-below-xml-cursor": {
        "statements": [
            "conforms-to hres:write-store-object-below-xml-cursor",
            "hres:oai-pmh:exposed-metadata-format"
        ],
        "metadata": {
            "hres:oai-pmh:metadata-prefix":     "oai_dc",
            "hres:oai-pmh:schema":              "http://www.openarchives.org/OAI/2.0/oai_dc.xsd",
            "hres:oai-pmh:metadata-namespace":  "http://www.openarchives.org/OAI/2.0/oai_dc/",
            "hres:oai-pmh:root-element":        "dc"
        }
    }
}
</pre>

Services are described in a @__service-metadata__.json@ file in your plugin's file directory. Each service to be added to the service registry is listed, and described with keys.

h3(key). statements

An array of statements describing the service.

In the example above we can see that the service is a metadata format exposed to OAI-PMH, and "conforms-to hres:write-store-object-below-xml-cursor". Consuming plugins match on these statements, to ensure the service retrieved from the registry performs as the consumer expects.

h3(key). metadata

An object of arbitrary key-value pairs of metadata. This should be used for information the consumer needs to know about this specific implementiation of a service.

Again using the example above; there may be many services registered that have the same @statements@ as this example, however the consumer will need to know what the schema and namespace this function uses are.


h2. Using the registry

h3(service). "haplo:service-registry:query"

The registry is accessed by calling this query service, passing in a @statements@ array. The service returns a Service List object, containing only the services registered that match all the requested statements.