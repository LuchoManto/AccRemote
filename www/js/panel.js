window.panel = {
    // mode: MODES.REMOTE, // starts on remote by default 
    buttons: { 2: 'aux', 3: 'jets', 4: 'system', 7: 'aux2', 6: 'light', 8: 'down', 9: 'up', 10: 'set-time', 11: 'set-temp' },
    buttons_codes: {
        'aux': 'x0', 'jets': 'j0', 'system': 's0', 'light': 'l0', 'aux2': 'a0',
        'down': 'd0', 'up': 'u0', 'set-time': 'd1', 'set-temp': 'u1'
    },
    reset_buttons: function () {
        for (var b in this.buttons) {
            $("#button-" + this.buttons[b] + "-frame").attr("style", $("#button-" + this.buttons[b] + "-frame").data("off"));
            var mytimer = $("#button-" + this.buttons[b] + "-frame").data("timer");
            if (mytimer !== '') {
                clearTimeout(mytimer);
                $("#button-" + this.buttons[b] + "-frame").data("timer", '');
            }
        }
    },
    link_buttons: function () {

        for (var b in this.buttons) {
            let on_style = $("#button-" + this.buttons[b] + "-frame").attr("style");
            if (on_style == undefined) continue; // unused button
            let off_style = on_style.replace(/stroke-opacity[^;]*;?/, "");
            if (off_style.length > 0) { off_style += ';' };
            off_style += 'stroke-opacity:0;fill-opacity:0;fill:#00ffff';
            $("#button-" + this.buttons[b] + "-frame").attr("style", off_style);
            // $("#button-" + this.buttons[b] + "-frame").data("b", 0);
            $("#button-" + this.buttons[b] + "-frame").data("off", off_style);
            $("#button-" + this.buttons[b] + "-frame").data("int", off_style + 'stroke-opacity:0;fill-opacity:0.2;fill:#ffffff');
            $("#button-" + this.buttons[b] + "-frame").data("timer", '');
            let button = this.buttons_codes[this.buttons[b]];

            $("#button-" + this.buttons[b] + "-frame").on("vclick", function () { // inside the function, 'this' is the html object that was clicked
                let tout = window.selected_device && window.selected_device.id ? 250 : 1000;
                $(this).attr("style", $(this).data("int"));
                transmitter.send_to_module("keyboard", button);
                var self = this;
                var mytimer = setTimeout(function () {
                    $(self).attr("style", off_style);
                }, tout);
                $(this).data("timer", mytimer);
            });
        }
    },
    device_limits: {
        spa: {
            temp_max_f: 104,
        //    temp_min_f: 45,
            temp_min_f: 40,     // new spec
            temp_max_c: 40,
            // temp_min_c: 7.6,
            temp_min_c: 4.8,    // new spec
        },
        sauna: {
            temp_max_f: 160,
            temp_min_f: 50,
            temp_max_c: 70.8,
            temp_min_c: 10.3,
            session_max: 60,
            session_min: 10
        }
    },
    oldvalue: null,
    set_sliders: function (type) {
        if (type === "spa")
            $("#session-time").hide();
        else if (type === "sauna")
            $("#session-time").show();

        $("#flip-scale").on("change", function () {
            var scale = this.value;
            if (scale == 0) {
                $("#slider-temp").attr("min", panel.device_limits[type].temp_min_f)
                    .attr("max", panel.device_limits[type].temp_max_f)
                    .attr("step", 1).val($("#slider-2-temp").val());
            }
            else {
                let cval = panel.f2c($("#slider-2-temp").val());
                $("#slider-temp").attr("min", panel.device_limits[type].temp_min_c)
                    .attr("max", panel.device_limits[type].temp_max_c)
                    .attr("step", .1).val(cval);
            }
        });
        $("#flip-scale").change();

        let oldvalue = $("#slider-temp").attr("value");
        $("#slider-temp").change(function () {
            if ($("#flip-scale").val() == 1) {
                var number = parseFloat(this.value);
                if (!(number <= panel.device_limits[type].temp_max_c && number >= panel.device_limits[type].temp_min_c)) number = panel.f2c(parseFloat(oldvalue));
                var n10 = ((number - 7.6) * 10).toFixed(0);
                var delta = n10 % 11;
                var base = Math.floor(n10 / 11);
                if (delta > 7) { base++; delta = 0 }
                else if (delta > 3) { delta = 5 }
                else { delta = 0 };
                var sal = base * 11 + delta;
                sal /= 10;
                sal += 7.6;
                $(this).val(sal.toFixed(1));
                var far = 45 + base * 2;
                if (delta) far++;
                $("#slider-2-temp").val(far.toFixed(0));
            }
            else {
                if (!(this.value <= panel.device_limits[type].temp_max_f && this.value >= panel.device_limits[type].temp_min_f)) this.value = oldvalue;
                $("#slider-2-temp").val(this.value);
            }
        }).change();

        $("#submit-temp").on('click', function () {
            // alert("submitted temp " + $("#slider-temp").val());
            transmitter.send_to_module("temperature", $("#slider-temp").val().replace(".", "") + ($("#flip-scale").val() == 1 ? "C" : "F"));
        });

        // var slider_session = new Slider("session", 10, MAX_SESSION, MIN_SESSION, bt_module);

        $("#slider-session").attr("min", panel.device_limits[type].session_min);
        $("#slider-session").attr("max", panel.device_limits[type].session_max);
        $("#slider-session").change(function () {
            $("#slider-session").val(this.value);
        }).change();
        $("#submit-session").on('click', function () {
            // alert("submitted session " + $("#slider-session").val());
            transmitter.send_to_module("session", $("#slider-session").val());

        });
    },
    f2c: function (far) {
        var stepval = far - 45;
        stepval = stepval.toFixed(0);
        var hstepval = Math.floor(stepval / 2);
        var cval = stepval % 2 ? 8.1 + hstepval * 1.1 : 7.6 + hstepval * 1.1;
        return cval.toFixed(1);
    },

    digits: [0, 1, 2, 3],
    snames: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    segments: new Array(6),
    onstyles: new Array(6),
    offstyles: new Array(6),

    init_leds: function () {
        for (var d in this.digits) {
            this.segments[d] = new Array(8);
            for (var s in this.snames) {
                this.segments[d][s] = $("#digit-d" + d + "-s" + this.snames[s]);
            }
        }

        // Then initializes rest of array with notification leds
        this.segments[4] = new Array(8);
        this.segments[4][0] = $("#led-heating"); // led 'system' en sauna
        this.segments[4][1] = $("#led-airhi");
        this.segments[4][2] = $("#led-jetslo");
        this.segments[4][3] = $("#led-jetshi"); // led 'heating' en sauna
        this.segments[4][4] = $("#led-filtering");
        this.segments[4][5] = $("#led-edit");
        this.segments[4][6] = $("#led-overheat");
        this.segments[4][7] = $("#led-am");

        this.segments[5] = new Array(8);
        this.segments[5][4] = $("#led-light");
        this.segments[5][5] = $("#led-jets2hi");
        this.segments[5][6] = $("#led-jets2lo");
        this.segments[5][7] = $("#led-airlo");

        for (var d = 0; d < 6; d++) {
            this.onstyles[d] = new Array(8);
            this.offstyles[d] = new Array(8);
            for (var s = 0; s < 8; s++) {
                if (d == 5 && s < 4) continue;
                var auxonstyle = this.segments[d][s].attr("style");
                if (auxonstyle == undefined) continue; // unused led
                this.onstyles[d][s] = auxonstyle;
                var auxoffstyle = auxonstyle.replace(/fill-opacity[^;]*;?/, "");
                //            if (auxoffstyle.match(/^\s*$/)) {auxoffstyle+= ';'};
                if (auxoffstyle.length > 0) { auxoffstyle += ';' };
                auxoffstyle += 'fill-opacity:0.1';
                this.offstyles[d][s] = auxoffstyle;
            }
        }

    },
    scale_selected: null,
    display: function (rx) {
        if (typeof (rx) == 'string' && rx.length == 12) {
            for (var ii = 0; ii < 6; ii++) {
                var dd = parseInt(rx.substring(ii * 2, ii * 2 + 2), 16);
                if (dd == 'NaN') dd = 0;
                for (var jj = 0, mm = 1; jj < 8; jj++, mm <<= 1) {
                    if (ii == 5 && jj < 4) continue;
                    if (this.segments[ii][jj].attr("style") == undefined) continue; // unused led
                    this.segments[ii][jj].attr("style", (mm & dd) ? this.onstyles[ii][jj] : this.offstyles[ii][jj])
                }
            };
            if (this.scale_selected) return; // just once, check for ºF or ºC and preselect scale
            if (rx.match(/^b9/i)) {
                this.scale_selected = 1;
                $('#flip-scale').val(1).change();
            }
            else if (rx.match(/^f1/i)) {
                this.scale_selected = 1;
                $('#flip-scale').val(0).change();
            }
        }
    },
    load_device: function () {
        // $("#panel-title").text("spa");
        document.getElementById('canvas').innerHTML = window.frames["spa"];
        document.getElementById('canvas').setAttribute("align", "center");
        panel.link_buttons();
        panel.init_leds();
        panel.set_sliders("spa");
    }
}