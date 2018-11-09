/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    // Attempt to prevent the user entering information in the form.
    $(document).ready(function() {
        $("input,textarea,select", "#blank-form").each(function() {
            this.setAttribute("readonly", "readonly");
        });
        $("#blank-form").on("click", function(evt) {
            evt.preventDefault();
        });
        $("#blank-form").on("submit", function(evt) {
            evt.preventDefault();
        });
        $("#blank-form").on("focusin", function(evt) {
            $(evt.target).blur();
        });
    });

})(jQuery);
