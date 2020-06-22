/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var constructors = P.instructionConstructors = {};

// --------------------------------------------------------------------------

var commonValueInstructionDecode = function(batch, instruction, instructionAction, sourceDetailsForErrors) {
    let destinationName =   instruction.destination,
        destination =       batch.model._destinations[instruction.destination];
    if(!destination) {
        batch._reportError("Unknown destination in "+instructionAction+": "+destinationName);
        return [false];
    }
    let name = destination.name(instruction.name);
    if(!name) {
        batch._reportError("Unknown name in "+instructionAction+" "+instruction.name+" for destination "+destinationName);
        return [false];
    }
    let valueTransformer = name.constructValueTransformerFor(batch, instruction, sourceDetailsForErrors);
    if(!valueTransformer) {
        batch._reportError("Couldn't create value transformer for "+instructionAction+" "+destinationName+"/"+instruction.name);
        return [false];
    }
    let qualifier;
    if("qualifier" in instruction) {
        if(instruction.qualifier in QUAL) {
            qualifier = QUAL[instruction.qualifier];
        } else {
            batch._reportError("Invalid qualifier in "+instructionAction+" "+destinationName+"/"+instruction.name);
        }
    }
    let multivalue = !!instruction.multivalue;
    return [true, destination, name, multivalue, qualifier, valueTransformer];
};

// --------------------------------------------------------------------------

constructors["field"] = function(batch, instruction) {
    let source =            instruction.source,
        destinationName =   instruction.destination;
    let [ok, destination, name, multivalue, qualifier, valueTransformer] =
        commonValueInstructionDecode(batch, instruction, "field", "input field "+source);
    if(!ok) { return; }
    return function(transformation, context) {
        let value = context[source];
        if(value) {
            let transformedValue = valueTransformer(value);
            if(undefined !== transformedValue) {
                let target = transformation.getTarget(destinationName);
                destination.addValueToTargetWithName(transformedValue, target, name, multivalue, qualifier, transformation);
            }
        }
    };
};

P.makeExtractFunctionForSimpleFieldInstruction = function(batch, instruction) {
    let source = instruction.source;
    let [ok, destination, name, multivalue, qualifier, valueTransformer] =
        commonValueInstructionDecode(batch, instruction, "field", "input field "+source);
    if(!ok || !source) { return null; }
    return function(record) {
        return valueTransformer(record[source]);
    };
};

// --------------------------------------------------------------------------

constructors["field-structured"] = function(batch, instruction) {
    let sourceDestination = instruction.structured, // so it reads {"structured": "value:something"} in the control document
        destinationName =   instruction.destination;
    let [ok, destination, name, multivalue, qualifier, valueTransformer] =
        commonValueInstructionDecode(batch, instruction, "field-structured", "structured input field "+sourceDestination);
    if(!ok) { return; }
    if(!batch.model._destinations[sourceDestination]) {
        batch._reportError("Unknown structured value destination in field-structured: "+sourceDestination);
        return;
    }
    return function(transformation, context) {
        let value = transformation.getTarget(sourceDestination);
        if(value) {
            let transformedValue = valueTransformer(value);
            if(undefined !== transformedValue) {
                let target = transformation.getTarget(destinationName);
                destination.addValueToTargetWithName(transformedValue, target, name, multivalue, qualifier, transformation);
            }
        }
        transformation.clearTarget(sourceDestination);
    };
};

// --------------------------------------------------------------------------

constructors["set-value"] = function(batch, instruction) {
    let constantValue =     instruction.value,
        destinationName =   instruction.destination;
    let [ok, destination, name, multivalue, qualifier, valueTransformer] =
        commonValueInstructionDecode(batch, instruction, "set-value", "set value "+destinationName+"/"+instruction.name);
    if(!ok) { return; }
    let haveTransformedValue = false,
        transformedConstantValue;
    return function(transformation, context) {
        if(!haveTransformedValue) {
            transformedConstantValue = valueTransformer(constantValue);
            haveTransformedValue = true;
        }
        if(undefined !== transformedConstantValue) {
            let target = transformation.getTarget(destinationName);
            destination.addValueToTargetWithName(transformedConstantValue, target, name, multivalue, qualifier, transformation);
        }
    };
};

// --------------------------------------------------------------------------

constructors["remove-values"] = function(batch, instruction) {
    let destinationName =   instruction.destination,
        destination =       batch.model._destinations[instruction.destination];
    if(!destination) {
        batch._reportError("Unknown destination in remove-values: "+destinationName);
        return;
    }
    let name = destination.name(instruction.name);
    if(!name) {
        batch._reportError("Unknown name in remove-values for destination "+destinationName);
        return;
    }
    return function(transformation, context) {
        // Target needs to be loaded with getTarget() so existing objects are modified.
        // (Don't be tempted to optimised this load away!)
        let target = transformation.getTarget(destinationName);
        destination.removeValueFromTargetWithName(target, name, transformation);
    };
};

// --------------------------------------------------------------------------

constructors["if-exists"] = function(batch, instruction) {
    let source =            instruction.source,
        thenList =          batch._prepareInstructionList(instruction.then),
        elseList =          batch._prepareInstructionList(instruction.else);
    return function(transformation, context) {
        transformation._executeInstructionList(
            (source in context) ? thenList : elseList,
            context
        );
    };
};

// --------------------------------------------------------------------------

constructors["if-value-one-of"] = function(batch, instruction) {
    let source =            instruction.source,
        values =            instruction.values || [],
        thenList =          batch._prepareInstructionList(instruction.then),
        elseList =          batch._prepareInstructionList(instruction.else);
    return function(transformation, context) {
        let value = context[source];
        transformation._executeInstructionList(
            ((source in context) && (-1 !== values.indexOf(value))) ? thenList : elseList,
            context
        );
    };
};


// --------------------------------------------------------------------------

constructors["if-has-value"] = function(batch, instruction) {
    let destinationName =   instruction.destination,
        thenList =          batch._prepareInstructionList(instruction.then),
        elseList =          batch._prepareInstructionList(instruction.else);
    let [ok, destination, name, multivalue, qualifier, valueTransformer] =
        commonValueInstructionDecode(batch, instruction, "if-has-value", "name "+instruction.name);
    if(!ok) { return; }
    return function(transformation, context) {
        let target = transformation.getTarget(destinationName);
        transformation._executeInstructionList(
            destination.hasValueForName(target, name, transformation) ? thenList : elseList,
            context
        );
    };
};

// --------------------------------------------------------------------------

constructors["within"] = function(batch, instruction) {
    let source =            instruction.source,
        instructions =      batch._prepareInstructionList(instruction.instructions);
    return function(transformation, context) {
        let nested = context[source];
        if(nested) {
            transformation._executeInstructionList(
                instructions,
                nested
            );
        }
    };
};
// --------------------------------------------------------------------------

constructors["for-each"] = function(batch, instruction) {
    let source =            instruction.source,
        wrapValues =        !!instruction.wrapValues,
        instructions =      batch._prepareInstructionList(instruction.instructions);
    return function(transformation, context) {
        _.each(context[source], (nested) => {
            if(wrapValues) {
                nested = {value:nested};
            }
            transformation._executeInstructionList(
                instructions,
                nested
            );
        });
    };
};

// --------------------------------------------------------------------------

constructors["new"] = function(batch, instruction) {
    let destinationName = instruction.destination;
    return function(transformation, context) {
        transformation.newTargetForDestination(destinationName);
    };
};

// --------------------------------------------------------------------------

constructors["assert-destination"] = function(batch, instruction) {
    let destinationName = instruction.destination,
        destination =     batch.model._destinations[instruction.destination],
        expectedExists =  instruction.exists;
    if(!destination) {
        batch._reportError("Unknown destination in assert-destination: "+destinationName);
        return;
    }
    if(!destination._depends) {
        batch._reportError("Can only use dependent destinations in assert-destination: "+destinationName);
        return;
    }
    return function(transformation, context) {
        let depends = destination._depends,
            dependentTarget = transformation.getTarget(depends),
            exists = !!destination.tryMakeTargetAvailableForDependency(depends, dependentTarget);
        if(exists !== expectedExists) {
            transformation.abortRecord();
            batch._reportError("assert-destination failed: "+destinationName);
        }
    };
};

// --------------------------------------------------------------------------

constructors["load"] = function(batch, instruction) {
    let destinationName =   instruction.destination,
        loadInfoSource =    instruction.using,
        haveOtherwise =     "otherwise" in instruction,
        otherwise =         haveOtherwise ? batch._prepareInstructionList(instruction.otherwise) : undefined;
    return function(transformation, context) {
        let loadInfo = transformation.getTarget(loadInfoSource);
        let loaded = transformation.tryLoadTargetForDestination(destinationName, loadInfo);
        transformation.clearTarget(loadInfoSource);
        if(!loaded) {
            if(haveOtherwise) {
                transformation._executeInstructionList(otherwise, context);
            } else {
                transformation.abortRecord();
                batch._reportError("Couldn't load destination: "+destinationName);
            }
        }
    };
};

// --------------------------------------------------------------------------

constructors["abort-record"] = function(batch, instruction) {
    let message = instruction.message || 'abort';
    return function(transformation, context) {
        transformation.abortRecord();
        batch._reportError(message);
    };
};

// --------------------------------------------------------------------------

constructors["log-error"] = function(batch, instruction) {
    let message = instruction.message || 'error';
    return function(transformation, context) {
        batch._reportError(message);
    };
};
