/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    $(document).ready(function() {

        var container = $('#haplo-people-picker-container');
        var linkSpec = container[0].getAttribute('data-picker');
        var kind = container[0].getAttribute('data-kind');

        // Look up tree to find person kind from DOM data attribute
        var findKind = function(e) { return $(e).parents('.haplo-people-picker-kind').first()[0].getAttribute('data-kind'); };

        // Look up tree to find person ref from DOM data attribute
        var findPersonIdentifier = function(e) { return $(e).parents('.haplo-people-picker-person-entry').first()[0].getAttribute('data-identifier'); };

        // Generate a path on the server
        var urlPath = function(action) { return '/do/haplo-people-picker/'+action+'/'+linkSpec; };

        // ------------------------------------------------------------------
        // Form user interface, implementing the oForm render-template element
        var formUI = $('#haplo-people-picker-form-element');
        if(formUI.length) {

            // HACK: Use a boolean confirm field in the form to control validation
            var completeInput = $('.haplo-people-picker-is-complete input')[0] || {};
            completeInput.type = 'hidden';
            var updateCompleteInput = function() {
                completeInput.value = ($('.haplo-people-picker-list-container')[0].getAttribute('data-complete') === 't') ? 't' : '';
            };
            updateCompleteInput(); // set initial state

            var initialiseSortableUI = function() {
                var selectorString = "div.haplo-people-picker-person-entry:has(.haplo-people-picker-person-reorder-button)";
                if($(selectorString).length) {
                    $(".haplo-people-picker-kind").sortable({
                        axis: "y",
                        containment: "parent",
                        items: selectorString,
                        tolerance: "pointer",
                        update: function(event, ui) {
                            var orderedIdentifiers = [];
                            // .parent().children() ensures order is top to bottom
                            ui.item.parent().children(".haplo-people-picker-person-entry").each(function(index, person) {
                                orderedIdentifiers.push(person.getAttribute("data-identifier"));
                            });
                            $.ajax(urlPath('reorder'), {
                                method: "POST",
                                data: {
                                    __: $('input[name=__]').val(),  // token
                                    kind: findKind(ui.item),
                                    order: orderedIdentifiers.join(",")
                                }
                            });
                        }
                    });
                }
            };

            initialiseSortableUI();

            // Update with new list from server
            var updateList = function(html) {
                formUI[0].innerHTML = html;
                initialiseSortableUI();
                updateCompleteInput();
            };

            // Add
            container.on('click', '.haplo-people-picker-empty-slot, .haplo-people-picker-add a', function(evt) {
                evt.preventDefault();
                var kind = findKind(this);
                Haplo.ui.openCovering(urlPath('add')+'?kind='+kind, 'Cancel', 800, 800);
            });

            // Remove
            container.on('click', '.haplo-people-picker-person-remove a', function(evt) {
                evt.preventDefault();
                $.ajax(urlPath('remove'), {
                    method: "POST",
                    data: {
                        __: $('input[name=__]').val(),  // token
                        kind: findKind(this),
                        person: findPersonIdentifier(this)
                    },
                    success: function(html) {
                        updateList(html);
                    }
                });
            });

            // Use when updating the document outside of the people picker
            window.haplo_people_picker_refresh_from_server = function(kind) {
                $.ajax(urlPath('refresh'), {
                    method: "GET",
                    data: {
                        kind: kind
                    },
                    success: function(html) {
                        updateList(html);
                    }
                });
            };

            // Update from page in covering iFrame
            window.haplo_people_picker_update = function(html, close) {
                updateList(html);
                if(close) { Haplo.ui.closeCovering(); }
            };

            // Show (then edit) details form
            container.on('click', '.haplo-people-picker-person-entry-form-button a', function(evt) {
                evt.preventDefault();
                Haplo.ui.openCovering(urlPath('details')+'?edit=1&kind='+findKind(this)+'&person='+findPersonIdentifier(this), 'Cancel', 800, 800);
            });
        }

        // ------------------------------------------------------------------
        // Update when people list modified
        var redisplayInfo = $('#haplo-person-picker-redisplay');
        if(redisplayInfo.length) {
            var redirect = redisplayInfo[0].getAttribute("data-redirect");
            window.parent.haplo_people_picker_update(redisplayInfo[0].getAttribute("data-html"), !redirect);
            if(redirect) { window.location = redirect; }
        }

        // ------------------------------------------------------------------
        // Add user with lookup
        var addUI = $('#haplo-people-picker-add-ui');
        if(addUI.length) {

            var hasForm = !!(addUI[0].getAttribute('data-hasform'));

            var queryCache = {};
            var queryInProgress = false;

            var maybeUpdateForCurrentQuery = function() {
                var query = $.trim($('#haplo-people-picker-search').val()).replace(/\s+/g,' ');
                if(query) {
                    var html = queryCache[query];
                    if(html) {
                        $('#haplo-people-picker-add-results')[0].innerHTML = html;
                    } else {
                        if(!queryInProgress) {
                            queryInProgress = true;
                            $.ajax(urlPath('person-search'), {
                                data: {
                                    kind: kind,
                                    q: query
                                },
                                success: function(data) {
                                    queryCache[query] = data;
                                    $('#haplo-people-picker-add-results')[0].innerHTML = data;
                                    // Maybe there's more typing?
                                    window.setTimeout(maybeUpdateForCurrentQuery, 50);
                                },
                                error: function() {
                                    // On an error, try again in a few seconds
                                    window.setTimeout(maybeUpdateForCurrentQuery, 2000);
                                },
                                complete: function() {
                                    queryInProgress = false;
                                }
                            });
                        }
                    }
                }
            };

            addUI.on('keyup', '#haplo-people-picker-search', function(evt) {
                window.setTimeout(maybeUpdateForCurrentQuery, 10);
            });

            addUI.on('click', '#haplo-person-picker-search-result-container .haplo-person-picker-search-result a', function(evt) {
                evt.preventDefault();
                var person = this.getAttribute('data-person');
                if(person) {
                    var form = $('#haplo-people-picker-add-form');
                    if(hasForm) {
                        $('#haplo-people-picker-add-form input[name=__]').remove(); // don't put CSRF token in URL
                        form[0].method = "GET";
                    }
                    $('#haplo-people-picker-add-form input[name=ref]').val(person);
                    form.submit();
                }
            });
        }

    });

})(jQuery);
