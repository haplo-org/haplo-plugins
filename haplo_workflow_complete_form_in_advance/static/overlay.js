/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    $(document).on('click', '._cfiaow_edit', function(evt) {
        evt.preventDefault();
        Haplo.ui.openCovering(this.href, "Close");
        window.advance_form_editor = {
            onEditClose: function() {
                window.setTimeout(function() {
                    Haplo.ui.closeCovering();
                    window.location.reload(true);
                }, 1000);
            }
        };
    });

})(jQuery);
