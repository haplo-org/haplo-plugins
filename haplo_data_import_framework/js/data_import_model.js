/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:data-import-framework:model", function(modelName) {
    let models = P.getAvailableModels();
    if(!(modelName in models)) {
        throw new Error("Unknown model: "+modelName);
    }
    let info = models[modelName];
    let model = new Model(modelName, info.service);
    model.setProperties(info.properties);
    model._setup();
    return model;
});

// --------------------------------------------------------------------------

var _models;

P.getAvailableModels = function() {
    if(!_models) {
        _models = {};
        O.service("haplo:service-registry:query", ["conforms-to haplo:data-import-framework:setup-model"]).services.forEach((m) => {
            _models[m.metadata.name] = {
                service: m.name,
                properties: m.metadata
            };
        });
    }
    return _models;
};

// --------------------------------------------------------------------------

var Name = P.Name;

// --------------------------------------------------------------------------

var Model = function(name, setupService) {
    this.name = name;
    this.setupService = setupService;
    this.properties = {
        name: "Unnamed model",
        description: "No description available"
    };
    this._destinations = {};
};

Model.prototype = {

    _setup() {
        // Get other plugins to set up all the bits for this model
        O.service(this.setupService, this);
        // Add pseudo destinations for structured types
        let haveSetupForType = {};
        _.each(this._destinations, (destination, destinationName) => {
            _.each(destination._names, (name, nameName) => {
                let dataType = name.properties.type || "text";
                if(!haveSetupForType[dataType]) {
                    O.serviceMaybe("haplo:data-import-framework:structured-data-type:add-destination:"+dataType, this);
                    haveSetupForType[dataType] = true;
                }
            });
        });
        // Add pseudo destinations for destination types
        let usedAdders = [];
        _.each(this._destinations, (destination, destinationName) => {
            let adder = destination._destinationPseudoDestinationAdder;
            if(adder && (-1 === usedAdders.indexOf(adder))) {
                adder(this);
                usedAdders.push(adder);
            }
        });
    },

    setProperties(props) {
        _.extend(this.properties, props);
    },

    addDestination(delegate) {
        if(!("name" in delegate)) {
            throw new Error("Destination delegate doesn't have name property");
        }
        if(this._destinations[delegate.name]) {
            throw new Error("Destination "+delegate.name+" already exists for model "+this.name);
        }
        let DestinationConstructor = DESTINATION_KIND[delegate.kind];
        if(!DestinationConstructor) {
            throw new Error("Destination "+delegate.name+" has an unrecognised kind: "+delegate.kind);
        }
        let destination = new DestinationConstructor(delegate);
        destination._setupBase();
        this._destinations[delegate.name] = destination;
    },

    destination(name) {
        let destination = this._destinations[name];
        if(!destination) { throw new Error("Destination not found: "+name); }
        return destination;
    },

    get destinations() {
        return _.values(this._destinations);
    }

};

// --------------------------------------------------------------------------

const DESTINATION_KIND = {};

var DestinationBase = function() {};
DestinationBase.prototype = {

    _setupBase() {
        let names = {},
            defns = this._getNameDefinitions();
        _.each(defns, (properties, name) => {
            let n = new Name(name, properties);
            names[name] = n;
        });
        this._names = names;
        this._isPseudoDestination = !!this.delegate.pseudo;
        this._setup();
    },

    get _displaySortValue() {
        if(!this.__displaySortValue) {
            this.__displaySortValue = _.sprintf("%08d/%s", this.delegate.displaySort||99999, this.delegate.name);
        }
        return this.__displaySortValue;
    },

    get destinationName() {
        return this.delegate.name;
    },

    get title() {
        return O.interpolateNAMEinString(this.delegate.title);
    },

    get _namesList() {
        return _.values(this._names);
    },

    get _depends() {
        return this.delegate.depends;
    },

    name(nameName) {
        return this._names[nameName];
    },

    checkTarget(target, transformation) {
        if(!target) {
            if(!this.delegate.optional) {
                transformation.abortRecord();
                transformation.batch._reportError("No data set in required destination "+this.destinationName);
            }
        } else {
            this._checkTarget(target, transformation);
        }
    }

};

var makeDestinationKind = function(kind) {
    let constructor = function(delegate) {
        this.delegate = delegate;
    };
    constructor.prototype = new DestinationBase();
    DESTINATION_KIND[kind] = constructor;
    return constructor;
};

// --------------------------------------------------------------------------

var DestinationDictionary = makeDestinationKind('dictionary');

DestinationDictionary.prototype._setup = function() {
    let required = [];
    _.each(this.delegate.dictionaryNames, (properties, name) => {
        if(properties.required) {
            required.push(name);
        }
    });
    this._requiredNames = required.sort();
};

DestinationDictionary.prototype._getNameDefinitions = function() {
    return this.delegate.dictionaryNames;
};

DestinationDictionary.prototype.constructNewDestinationTarget = function() {
    return {};
};

DestinationDictionary.prototype.tryLoadDestinationTarget = function(loadInfo) {
    if("tryLoadDestinationTarget" in this.delegate) {
        return this.delegate.tryLoadDestinationTarget(loadInfo);
    }
};

DestinationDictionary.prototype.tryMakeTargetAvailableForDependency = function(dependencyDestinationName, dependencyTarget) {
    if("tryMakeTargetAvailableForDependency" in this.delegate) {
        return this.delegate.tryMakeTargetAvailableForDependency(dependencyDestinationName, dependencyTarget);
    }
};

DestinationDictionary.prototype.createCommitter = function(target, transformation) {
    return () => {
        if(!this.delegate.commit) {
            throw new Error("Delegate for "+this.destinationName+" does not implement commit()");
        }
        this.delegate.commit(target, this.destinationName, transformation);
    };
};

// Note: Dictionaries ignore qualifiers
DestinationDictionary.prototype.addValueToTargetWithName = function(value, target, name, multivalue, qualifier, transformation) {
    if(name.isMultivalue) {
        if(multivalue) {
            if(!(name.name in target)) {
                target[name.name] = [];
            }
            target[name.name].push(value);
        } else {
            // While this is a multivalue name, it's being set as a single value
            target[name.name] = [value];
        }
    } else {
        target[name.name] = value;
    }
};

DestinationDictionary.prototype.removeValueFromTargetWithName = function(target, name, transformation) {
    delete target[name.name];
};

DestinationDictionary.prototype.hasValueForName = function(target, name, transformation) {
    return name.name in target;
};

DestinationDictionary.prototype._checkTarget = function(target, transformation) {
    let missing = [];
    this._requiredNames.forEach((name) => {
        if(!(name in target)) {
            missing.push(name);
        }
    });
    if(missing.length) {
        transformation.abortRecord();
        transformation.batch._reportError("Missing values in "+this.destinationName+": "+missing.join(', '));
    }
};

// --------------------------------------------------------------------------

var DestinationObject = makeDestinationKind('object');

var TYPECODE_TO_DATA_TYPE = {}; // names should match schema requirements
TYPECODE_TO_DATA_TYPE[O.T_DATETIME] =                       "date";
TYPECODE_TO_DATA_TYPE[O.T_TEXT] =                           "text";
TYPECODE_TO_DATA_TYPE[O.T_TEXT_PERSON_NAME] =               "person-name";
TYPECODE_TO_DATA_TYPE[O.T_TEXT_PARAGRAPH] =                 "text-paragraph";
TYPECODE_TO_DATA_TYPE[O.T_TEXT_MULTILINE] =                 "text-multiline";
TYPECODE_TO_DATA_TYPE[O.T_IDENTIFIER_CONFIGURATION_NAME] =  "configuration-name";
TYPECODE_TO_DATA_TYPE[O.T_IDENTIFIER_POSTAL_ADDRESS] =      "postal-address";
TYPECODE_TO_DATA_TYPE[O.T_IDENTIFIER_EMAIL_ADDRESS] =       "email-address";
TYPECODE_TO_DATA_TYPE[O.T_IDENTIFIER_URL] =                 "url";
TYPECODE_TO_DATA_TYPE[O.T_IDENTIFIER_TELEPHONE_NUMBER] =    "telephone-number";

DestinationObject.prototype._setup = function() {
};

DestinationObject.prototype._getNameDefinitions = function() {
    // Create Names for each of the attribute in the schema
    let defns = {},
        without = this.delegate.without || [],
        override = this.delegate.objectAttributesOverride || {},
        type = SCHEMA.getTypeInfo(this.delegate.objectType);
    if(type) {
        type.attributes.forEach((desc) => {
            let attr = SCHEMA.getAttributeInfo(desc);
            if(attr && attr.code && (-1 === without.indexOf(attr.code))) {
                let props = {
                    description: attr.name,
                    multivalue: true
                };
                let typecode = attr.typecode;
                if(typecode === O.T_REF) {
                    props.type = "ref";
                    props.refTypes = attr.types;
                } else {
                    let dataType = TYPECODE_TO_DATA_TYPE[typecode];
                    if(dataType) {
                        props.type = dataType;
                    } else {
                        // Ignore unsupported value types
                        return;
                    }
                }

                // Titles are required
                if(desc === ATTR.Title) {
                    props.required = true;
                    // And since it has a title, flag it needs to be checked
                    this._checkTitleExists = true;
                }

                // Destination might want to override things (primarily when aliases used)
                if(override[attr.code]) { _.extend(props, override[attr.code]); }

                // Types get a special ref type so they can be handled specially
                if(attr.code === "dc:attribute:type") { props.type = "object-type"; }

                defns[attr.code] = props;
            }
        });
    }
    return defns;
};

// How targets can be loaded for this destination kind (only called once per model)
DestinationObject.prototype._destinationPseudoDestinationAdder = function(model) {
    model.addDestination({
        name: "load:by-ref",
        title: "Load by ref (loader)",
        displaySort: 999998,
        pseudo: true,
        excludeFromGenerator: true,
        kind: "dictionary",
        dictionaryNames: {
            ref: {description:"Ref of object", type:"ref"}
        }
    });
};

DestinationObject.prototype.constructNewDestinationTarget = function() {
    let object = O.object();
    return object;
};

DestinationObject.prototype.tryLoadDestinationTarget = function(loadInfo) {
    // TODO: Call function in delegate?
    if(O.isRef(loadInfo.ref)) {
        let object = loadInfo.ref.load();
        if(object && object.isKindOf(this.delegate.objectType)) {
            return object.mutableCopy();
        }
    }
};

DestinationObject.prototype.tryMakeTargetAvailableForDependency = function(dependencyDestinationName, dependencyTarget) {
    let depDesc = this.delegate.objectDependsWithAttribute;
    if(depDesc) {
        if(dependencyTarget.ref) {
            // Dependency already exists, is there an object of this type linked already?
            let q = O.query().
                link(this.delegate.objectType, ATTR.Type).
                link(dependencyTarget.ref, depDesc).
                limit(1).
                sortByDateAscending().
                execute();
            if(q.length > 0) {
                return q[0].mutableCopy();
            }
        }
        // Otherwise just make a new one, which gets linked in the committer function
        return this.constructNewDestinationTarget();
    }
};

DestinationObject.prototype.createCommitter = function(target, transformation) {
    return () => {
        if(!target.firstType()) {
            target.appendType(this.delegate.objectType);
        }
        let depDesc = this.delegate.objectDependsWithAttribute;
        if(depDesc) {
            if(!target.first(depDesc)) {
                let dependTarget = transformation.getTarget(this.delegate.depends);
                if(!dependTarget.ref) {
                    dependTarget.preallocateRef();
                }
                target.append(dependTarget.ref, depDesc);
            }
        }
        // Check this actually needs to be committed
        let isNewObject = (target.version === 0);
        if(!isNewObject) {
            let currentVersion = target.ref.load();
            if(currentVersion.valuesEqual(target)) {
                return; // nothing changed
            }
        }
        transformation.batch._notifyObserver("object:save", [transformation, this.destinationName, target, isNewObject]);
        target.save();
    };
};

DestinationObject.prototype.addValueToTargetWithName = function(value, target, name, multivalue, qualifier, transformation) {
    let desc = ATTR[name.name];
    if(!multivalue) {
        target.remove(desc, qualifier);
    }
    target.append(value, desc, qualifier);
};

DestinationObject.prototype.removeValueFromTargetWithName = function(target, name, transformation) {
    let desc = ATTR[name.name];
    target.remove(desc);
};

DestinationObject.prototype.hasValueForName = function(target, name, transformation) {
    return !!target.first(ATTR[name.name]);
};

DestinationObject.prototype._checkTarget = function(target, transformation) {
    if(this._checkTitleExists) {
        if(!target.firstTitle()) {
            transformation.abortRecord();
            transformation.batch._reportError("dc:attribute:title is not set in object "+this.destinationName);
            if(!transformation.batch.$destinationObjectOutputMissingTitleWarning) {
                transformation.batch.$destinationObjectOutputMissingTitleWarning = true;
                transformation.batch._reportError("To set defaults for dc:attribute:title, see example of if-has-value instruction at https://docs.haplo.org/import/control/instruction/if-has-value");
            }
        }
    }
};
