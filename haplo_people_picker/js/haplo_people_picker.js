/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
    TODO: Documentation

    render-element + boolean confirm element with special class in form

    implement service haplo:people-picker:define:<picker name> which returns spec given key (M)

    picker has spec:
        documentPropertyName - property in underlying docstore
        kinds - array of kind specs
        totalMinCount - (optional) minimum number of people regardless of kind

    kind has spec:
        kind - name
        displayName - for user, remember i18n
        types - array of relevant people types
        form - (optional) form for additional info, automatically rememembered between uses
        newPersonForm - (optional) function to return a kind specific form for creating a new person of a given type
        formDisableRemember - true to not do remembering, if old info is never relevant
        minCount - required numbers
        maxCount - required numbers
        prepareFormInstance - (optional) - key, form, instance, context, personObjectMaybe
        updateNewPersonDocument - (optional) - document // only for updating person basic details i.e. title, first/last name, email
        updateDocumentBeforeEdit - (optional) personRef, document
        guidanceDeferred - (optional) Deferred render to display guidance above the @displayName@
        allowEnterNew - (optional) Allow users to create new people of any type in the @types@ property
        disallowEnterNewForTypes - (optional) Allow specific types out of the @types@ property to be excluded from the new person UI


    could be extended to cope with more than just docstores in workflows

    to add details to search results, implement the "haplo:people-picker:search-result-info" service
*/

const MAX_LOOKUP_RESULTS = 10;
const MAX_PRIORITY_RESULTS = 8;
var NewPerson = P.form("new-person", "form/new-person.json");
var formLookup = O.refdictHierarchical();
formLookup.set(TYPE["std:type:person"], NewPerson);

// --------------------------------------------------------------------------

P.globalTemplateFunction("haplo:people-picker:__impl__", function(element) {
    let picker = new Picker(
        element.view.pick,
        element.externalData["std_document_store:key"],
        element.externalData["std_document_store:store"],
        element.externalData["std_document_store:instance"],
        element.isRenderingForm);
    this.render(P.template("impl/picker").deferredRender({
        picker: picker
    }));
});

// --------------------------------------------------------------------------

// Key is "<ref> <picker-name> <form id>"
var RememberedForms = P.defineDocumentStore({
    name: "remembered",
    keyIdType: "text"
});

// --------------------------------------------------------------------------

var Picker = function(pickerName, key, docstore, instance, editable) {
    this.pickerName = pickerName;
    this.key = key;
    this.docstore = docstore;
    this.instance = instance;
    this.editable = editable;
    this.spec = O.service("haplo:people-picker:define:"+this.pickerName, key);
    this.kinds = _.map(this.spec.kinds, (kindSpec) => new PickerKind(this, kindSpec));
    if(!this.kinds.length) { throw new Error("No kinds specified"); }
    if(editable) {
        // SECURITY: Having the signed link spec allows the user to change the data, so don't include it when read only.
        // Write a spec for generating links for the UI
        let keyToKeyId = this.docstore.delegate.keyToKeyId;
        let linkSpec = {
            n: this.pickerName,
            d: this.docstore.delegate.name,
            w: keyToKeyId ? keyToKeyId(key) : key,
            v: instance.committedVersionNumber || 0
        };
        if("getDocumentStoreAndKeyService" in this.spec) {
            if(!this.spec.getDocumentStoreAndKeyService.includes(":")) {
                throw new Error("getDocumentStoreAndKeyService must be namespaced.");
            }
            linkSpec.s = this.spec.getDocumentStoreAndKeyService;
        }
        let linkSpecEncoded = O.base64.encode(JSON.stringify(linkSpec), "url");
        this.linkSpecSigned = linkSpecEncoded + '-' + linkSpecSignature(linkSpecEncoded);
    }
};

Picker.prototype = {
    getKind(name) {
        let kind = _.find(this.kinds, (k) => k.kind === name);
        if(!kind) { O.stop("Unknown kind"); }
        return kind;
    },

    withPeopleAndMaybeUpdate(fn) {
        if(!this.instance) {
            this.instance = this.docstore.instance(this.key);
        }
        let currentDocument = this.instance.currentDocument;
        let property = this.spec.documentPropertyName;
        if(!property) { throw new Error("documentPropertyName not specified"); }
        let people = currentDocument[property] || {};
        let modified = fn(people);
        if(undefined !== modified) {
            this._kindsHavePeople = false;
            currentDocument[property] = modified;
            this.instance.setCurrentDocument(currentDocument, this.instance.currentDocumentIsComplete);
        }
    },

    _ensureKindsHavePeople() {
        if(this._kindsHavePeople) { return; }
        this.withPeopleAndMaybeUpdate((people) => {
            this.kinds.forEach((kind) => {
                kind._setPeople(people[kind.kind] || []);
            });
        });
        this._kindsHavePeople = true;
    },

    get isComplete() {
        let complete = true;
        this.kinds.forEach((kind) => {
            if(!kind.isComplete) { complete = false; }
        });
        if("totalMinCount" in this.spec) {
            let allKindsPeople = 0;
            this.kinds.forEach((kind) => {
                allKindsPeople += kind.people.length;
            });
            if(allKindsPeople < this.spec.totalMinCount) { complete = false; }
        }
        return complete;
    }
};

// --------------------------------------------------------------------------

var PickerKind = function(picker, kindSpec) {
    this.picker = picker;
    this.kind = kindSpec.kind;
    if(!this.kind) { throw new Error("No kind property specified in kind definition"); }
    this.kindSpec = kindSpec;
};

PickerKind.prototype = {
    get people() {
        this.picker._ensureKindsHavePeople();
        return this._people;
    },

    getPerson(identifier) {
        return _.find(this.people, (p) => p.data.identifier === identifier);
    },

    get isComplete() {
        let people = this.people;
        let complete = true;
        if("minCount" in this.kindSpec) {
            if(people.length < this.kindSpec.minCount) { complete = false; }
        }
        if(complete && this.hasForm) {
            people.forEach((p) => {
                if(!p.formIsComplete) { complete = false; }
            });
        }
        return complete;
    },

    get hasForm() {
        return "form" in this.kindSpec;
    },

    get canAddAnotherPerson() {
        if(!("maxCount" in this.kindSpec)) {
            return true;
        }
        return this.people.length < this.kindSpec.maxCount;
    },

    get formDescription() {
        return this.kindSpec.form;
    },

    get emptySlots() {
        let count = this.people.length;
        let slots = [];
        let fill = (name, required) => {
            if(name in this.kindSpec) {
                for(; count < this.kindSpec[name]; ++count) {
                    slots.push({
                        index: count + 1,
                        required: required
                    });
                }
            }
        };
        fill("minCount", true);
        fill("maxCount", false);
        if((this.kindSpec.minCount === 0) && !("maxCount" in this.kindSpec) && !count) {
            slots.push({
                index: 1,
                required: false
            });
        }
        return slots;
    },

    _setPeople(peopleData) {
        this._people = peopleData.map((p) => {
            return new PickerPerson(this, p);
        });
    },

    preventSelectionOf(person) {
        if(this.kindSpec.preventSelectionOf) {
            return this.kindSpec.preventSelectionOf(person);
        }
    }
};

// --------------------------------------------------------------------------

var PickerPerson = function(kind, data) {
    this.kind = kind;
    this.data = data;
};

PickerPerson.prototype = {
    get object() {
        return this.data.ref ? O.ref(this.data.ref).load() : undefined;
    },

    get displayName() {
        let name;
        if(this.data.ref) {
            name = O.ref(this.data.ref).loadObjectTitleMaybe();
        } else {
            if(this.data.newPerson.displayName) {
                name = this.data.newPerson.displayName;
            } else {
                name = this.data.newPerson.title + ' ' + this.data.newPerson.firstName + ' ' + this.data.newPerson.lastName;
            }
        }
        return name;
    },

    get formIsComplete() {
        return ("document" in this.data) && !this.data.documentIncomplete;
    },

    get hasForm() {
        return this.kind.formDescription && ("document" in this.data);
    },

    get formTitle() {
        let formDesc = this.kind.formDescription;
        return formDesc ? formDesc.formTitleShort : undefined;
    },

    get formInstance() {
        let formDesc = this.kind.formDescription;
        if(formDesc) {
            let instance = formDesc.instance(this.data.document);
            if(this.kind.kindSpec.prepareFormInstance && this.data.ref) {
                this.kind.kindSpec.prepareFormInstance(this.kind.picker.key, formDesc, instance, this.data.document, O.ref(this.data.ref).load());
            }
            return instance;
        }
    }
};

// --------------------------------------------------------------------------

// Links contain signed references to link information, so the picker can be nicely generic
// with a tidy API, and inheriting the security checks of the consuming plugin.

// TODO: Should there be more security checking? Workflow is actionable by user, docstore editable, expiry time?

var linkSpecSignature = function(msg) {
    let secret = P.data.linkSpecSecret;
    if(!secret) {
        P.data.linkSpecSecret = secret = O.security.random.base64(128);
    }
    return O.security.hmac.sign("SHA256", secret, msg);
};

var pickerFromSignedLinkSpec = function(linkSpecSigned) {
    let [msg, sig] = (linkSpecSigned || '').split('-');
    let expectedSig = linkSpecSignature(msg);
    if(expectedSig !== sig) {
        O.stop("Not permitted");
    }
    let linkSpec = O.base64.decode(msg, "url").readAsJSON(); // know it's valid JSON, because signature means it's been generated by this plugin

    let docstore;
    let key;
    let keyId = linkSpec.w;
    if("s" in linkSpec) {
        [docstore, key] = O.service("haplo:people-picker:get-document-store-and-key:"+linkSpec.s, keyId);
    } else {
        let workUnit = O.work.load(keyId);
        let workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
        key = workflow.instance(workUnit);
        docstore = workflow.documentStore[linkSpec.d];
    }
    let instance = docstore.instance(key);
    // Security: Check version to ensure links can't be reused after form submitted
    if(linkSpec.v !== (instance.committedVersionNumber || 0)) {
        O.stop("Not permitted");
    }
    return new Picker(linkSpec.n, key, docstore, instance, true);
};

var checkedPickerAndKind = function(linkSpecSigned, kindName) {
    let picker = pickerFromSignedLinkSpec(linkSpecSigned);
    let kind = picker.getKind(kindName);
    return [picker, kind];
};

// --------------------------------------------------------------------------

var renderUpdateList = function(E, picker, kind, redirectToSelectWithIdentifier) {
    E.render({
        picker: picker,
        kind: kind,
        updated: P.template("impl/picker-list").render({picker:picker}),
        redirectToSelectWithIdentifier: redirectToSelectWithIdentifier
    }, "page/update-list");
};

P.implementService("haplo:people-picker:get-picker-details", function(key, pickerName) {
    return O.service("haplo:people-picker:define:"+pickerName, key);
});

P.implementService("haplo:people-picker:replace-new-person-with-ref", function(key, instance, pickerName, kindName, identifier, ref) {
    let picker = O.service("haplo:people-picker:define:"+pickerName, key);
    let document = instance.currentDocument;
    let usersOfKind = document[picker.documentPropertyName][kindName];
    let user = _.find(usersOfKind, (u) => {
        return u.identifier === identifier;
    });
    delete user.newPerson;
    user.ref = ref.toString();
    _.each(usersOfKind, (u, index) => {
        if(u.identifier === identifier) {
            usersOfKind[index] = user;
        }
    });
    instance.setCurrentDocument(document, true);

    // Remember picker form for new person
    let kindSpec = _.find(picker.kinds, (kindSpec) => {
        return kindSpec.kind === kindName;
    });
    let personDetails = _.find(usersOfKind, (details) => {
        return details.identifier === identifier;
    });
    if(kindSpec.form) {
        let rememberKey = ref.toString() + pickerName + " " + kindSpec.form.formId;
        let remembered = RememberedForms.instance(rememberKey);
        remembered.setCurrentDocument(personDetails.document, true);
    }
    return document;
}); 

P.respond("GET", "/do/haplo-people-picker/add", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"}
], function(E, linkSpecSigned, kindName) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    E.render({
        picker: picker,
        kind: kind
    }, "page/add");
});

P.respond("GET", "/do/haplo-people-picker/person-search", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"},
    {parameter:"q", as:"string"}
], function(E, linkSpecSigned, kindName, query) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    let results = [], haveMore = false, priorityResults;
    if(query) {
        let types = kind.kindSpec.types;
        if(!types) { O.stop("Bad types in Kind spec"); }
        results = [];
        O.query().
            link(types, ATTR.Type).
            freeText(query.split(/\s+/g).map(e => e+'*').join(' '), ATTR.Title).
            limit(MAX_LOOKUP_RESULTS+1).
            sortByTitle().
            execute().
            each((o) => results.push(o));
        if(kind.kindSpec.priorityResults) {
            priorityResults = kind.kindSpec.priorityResults(query);
            let prio = _.map(priorityResults, (p) => p.ref.toString());
            results = _.reject(results, (r) => prio.includes(r.ref.toString()));
            if(priorityResults.length > MAX_PRIORITY_RESULTS) {
                haveMore = true;
                priorityResults = Array.prototype.slice.call(priorityResults, 0, MAX_PRIORITY_RESULTS);
            }
            results = priorityResults.concat(results);
        }
        if(results.length > MAX_LOOKUP_RESULTS) {
            haveMore = true;
            results = Array.prototype.slice.call(results, 0, MAX_LOOKUP_RESULTS);
        }
    }
    E.render({
        layout: false,
        picker: picker,
        kind: kind,
        results: _.map(results, (person) => {
            // Augment result with additional info (application dependent)
            let infoBlocks = [];
            O.serviceMaybe("haplo:people-picker:search-result-info", person, infoBlocks, picker.pickerName);
            return {
                person: person,
                infoBlocks: _.sortBy(infoBlocks, 'sort'),
                warning: kind.preventSelectionOf(person)
            };
        }),
        haveMore: haveMore
    }, "page/person-search");
});

P.respond("GET,POST", "/do/haplo-people-picker/new", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"},
    {parameter:"type", as:"ref", optional:true}
], function(E, linkSpecSigned, kindName, type) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    let creatableTypes = _.reject(kind.kindSpec.types, (selectableType) => {
        return _.any(kind.kindSpec.disallowEnterNewForTypes, (disallowedType) => disallowedType == selectableType);
    });
    if(!type && (1 < creatableTypes.length)) {
        E.render({
            picker: picker,
            kind: kind,
            options: _.map(creatableTypes, (t) => {
                return {
                    action: "/do/haplo-people-picker/new/"+linkSpecSigned+"?kind="+kindName+"&type="+t.toString(),
                    label: SCHEMA.getTypeInfo(t).name
                };
            })
        }, "page/choose-type");
    } else {
        type = type || creatableTypes[0];
        if(!_.any(creatableTypes, (creatableType) => creatableType == type)) { O.stop("Not permitted."); }
        let document = {
            type: type.toString()
        };
        let kindFormDescription = kind.kindSpec.form;
        let formDefn = formLookup.get(type);
        if("newPersonForm" in kind.kindSpec) {
            let kindSpecFormDefn = kind.kindSpec.newPersonForm(type);
            if(kindSpecFormDefn) { formDefn = kindSpecFormDefn; }
        }
        if(!formDefn) {
            formDefn = O.service("haplo:people-picker:form-definition-for-type", type);
            formLookup.set(type, formDefn);
        }
        let form = formDefn.handle(document, E.request);
        let newPerson;
        if(E.request.method === "POST" && form.complete) {
            picker.withPeopleAndMaybeUpdate((people) => {
                let peopleOfThisKind = people[kind.kind] || [];
                newPerson = {
                    identifier: O.security.random.identifier(9),
                    newPerson: document
                };
                if(kindFormDescription) {
                    if(kind.kindSpec.updateNewPersonDocument) {
                        kind.kindSpec.updateNewPersonDocument(document);
                    }
                    newPerson.document = {};
                    newPerson.documentIncomplete = true;
                }
                peopleOfThisKind.push(newPerson);
                people[kind.kind] = peopleOfThisKind;
                return people;
            });
            return renderUpdateList(E, picker, kind, kindFormDescription ? newPerson.identifier : undefined);
        }
        E.render({
            picker: picker,
            kind: kind,
            form: form,
            invalid: (E.request.method === "POST")
        }, "page/new");
    }
});

P.respond("GET,POST", "/do/haplo-people-picker/select", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"},
    {parameter:"person", as:"string", optional:true},
    {parameter:"ref", as:"object", optional:true},
    {parameter:"edit", as:"string", optional:true}
], function(E, linkSpecSigned, kindName, personIdentifier, selectedPersonObject, isEdit) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    let existingPerson;
    picker.withPeopleAndMaybeUpdate((people) => {
        let peopleOfThisKind = people[kind.kind] || [];
        existingPerson = _.find(peopleOfThisKind, (p) => p.identifier === personIdentifier);
    });
    let view = {
        picker: picker,
        kind: kind,
        selectedPersonObject: selectedPersonObject,
        existingPerson: existingPerson
    };
    // Might have a form to display
    let remembered, document, form, rememberKey,
        formDescription = kind.kindSpec.form;
    if(formDescription) {
        if(selectedPersonObject && !kind.kindSpec.formDisableRemember) {
            rememberKey = selectedPersonObject.ref.toString() + picker.pickerName + " " + formDescription.formId;
            remembered = RememberedForms.instance(rememberKey);
        }
        if(isEdit) {
            view.isEdit = true;
            let editingPerson = _.find(kind.people, (p) => p.data.identifier === personIdentifier);
            if(editingPerson) {
                document = editingPerson.data.document;
            }
        }
        if(!document) {
            document = remembered ? remembered.currentDocument : {};
            view.haveRemembered = !_.isEmpty(document);
        }
        if(kind.kindSpec.updateDocumentBeforeEdit) {
            let personRef = selectedPersonObject ? selectedPersonObject.ref : null;
            kind.kindSpec.updateDocumentBeforeEdit(personRef, document);
        }
        form = formDescription.instance(document);
        if(kind.kindSpec.prepareFormInstance) {
            let existingPersonObject;
            if(existingPerson) { existingPersonObject = O.ref(existingPerson.ref).load(); }
            if(selectedPersonObject) { existingPersonObject = selectedPersonObject; }
            kind.kindSpec.prepareFormInstance(kind.picker.key, formDescription, form, document, existingPersonObject);
        }
        form.update(E.request);
        view.form = form;
    }
    let saveForLater = ("__save" in E.request.parameters);
    if(E.request.method === "POST" && (!form || form.complete || saveForLater)) {
        picker.withPeopleAndMaybeUpdate((people) => {
            let peopleOfThisKind = people[kind.kind] || [];
            let p = existingPerson || {
                // Only created when a person is selected
                identifier: O.security.random.identifier(9),
                ref: selectedPersonObject.ref.toString()
            };
            if(form) {
                p.document = document;
                if(form.complete) {
                    delete p.documentIncomplete;
                } else {
                    p.documentIncomplete = true;
                }
                if(remembered) {
                    remembered.setCurrentDocument(document, form.complete);
                }
            }
            if(!existingPerson) {
                peopleOfThisKind.push(p);
            }
            people[kind.kind] = peopleOfThisKind;
            return people;
        });
        return renderUpdateList(E, picker, kind);
    }
    if(E.request.method === "POST" && form && !form.complete) {
        view.incompleteForm = true;
    }
    E.render(view, "page/select");
});

P.respond("GET", "/do/haplo-people-picker/details", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"},
    {parameter:"person", as:"string"}
], function(E, linkSpecSigned, kindName, personIdentifier) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    let person = kind.getPerson(personIdentifier);
    E.render({
        picker: picker,
        kind: kind,
        person: person
    }, "page/details");
});

P.respond("POST", "/do/haplo-people-picker/remove", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"},
    {parameter:"person", as:"string"}
], function(E, linkSpecSigned, kindName, personIdentifier) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    picker.withPeopleAndMaybeUpdate((people) => {
        let peopleOfThisKind = people[kind.kind];
        if(peopleOfThisKind) {
            people[kind.kind] = _.filter(peopleOfThisKind, (p) => p.identifier !== personIdentifier);
            return people;
        }
    });
    E.render({
        layout: false,
        picker: picker
    }, "impl/picker-list");
});

P.respond("POST", "/do/haplo-people-picker/reorder", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"},
    {parameter:"order", as:"string"}
], function(E, linkSpecSigned, kindName, order) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    picker.withPeopleAndMaybeUpdate((people) => {
        let peopleOfThisKind = people[kind.kind];
        if(peopleOfThisKind) {
            people[kind.kind] = _.map(order.split(","), (identifier) => {
                return _.find(peopleOfThisKind, (person, index) => person.identifier === identifier);
            });
            return people;
        }
    });
    // Prevents 404 error in client console.
    E.response.statusCode = HTTP.OK;
    E.response.body = "";
});
P.respond("GET", "/do/haplo-people-picker/refresh", [
    {pathElement:0, as:"string"},
    {parameter:"kind", as:"string"}
], function(E, linkSpecSigned, kindName) {
    let [picker, kind] = checkedPickerAndKind(linkSpecSigned, kindName);
    E.render({
        layout: false,
        picker: picker
    }, "impl/picker-list");
});
