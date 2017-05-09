/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    $(document).ready(function() {

        $('.mergelink').on('click', function(event) {
            var row = $(this).parent().parent();
            // clear tray before adding new objects to it
            var clearUrl = '/do/tray?clear=all';
            $.get(clearUrl, function(data) {
                var profiles = [];
                row.find('.researcher').each(function(td) {
                    profiles.push($(this).data('ref'));
                });
                var reqs = [];
                profiles.forEach(function(ref) {
                    reqs.push($.get('/'+ref+'/?tray=a'));
                });
                $.when.apply($, reqs).done(function() {
                    // open merge tray in new tab
                    window.open('/do/editor-merge-objects/merge-tray', '_blank');
                });
            });
            event.preventDefault();
        });

        $('.remove').on('click', function(event) {
            var removeRow = $(this).closest('tr');
            var req = $.get($(this).attr('href'));
            removeRow.fadeOut(100);
            event.preventDefault();
        });

    });

})(jQuery);
