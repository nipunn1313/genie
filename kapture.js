var Kapture = function() {
    this.initialize();
};

Kapture.prototype.initialize = function() {
    this.stop_event = 0;
    this.last_event = null;
    this.last_guess = null;
    this.safe_input = false;

    this.capture_all = false;
    this.capture_buffer = [];
    this.capture_final = 'enter';

    this.documentation = {};
    
    this.keys_dict = {
        "48": "0", "49": "1", "50": "2", "51": "3", "52": "4", "53": "5", "54": "6", "55": "7", 
        "56": "8", "57": "9", "65": "a", "66": "b", "67": "c", "68": "d", "69": "e", "70": "f", 
        "71": "g", "72": "h", "73": "i", "74": "j", "75": "k", "76": "l", "77": "m", "78": "n",
        "79": "o", "80": "p", "81": "q", "82": "r", "83": "s", "84": "t", "85": "u", "86": "v", 
        "87": "w", "88": "x", "89": "y", "90": "z", "186": ";", "187": "=", "188": ",", "189": "-", 
        "190": ".", "191": "/", "192": "`", "219": "[", "220": "\\", "221": "]", "222": "'",
        "229": "q", "9":"tab", "27":"esc", "32":"space", "8":"backspace", "13":"enter", '229':'q',
        '37':'left', '38':'up', '39':'right', '40':'down',
    };

    this.modified_dict = {
        "shift-1":"!", "shift-2":"@", 'shift-3':'#', 'shift-4':'$', 'shift-5':'%',
        'shift-6':'^', 'shift-7':'&', 'shift-8':'*', 'shift-9':'(', 'shift-0':')',
        'shift--':'_', 'shift-=':'+', 'shift-`':'~', 'shift-a':'A', 'shift-b':'B', 
        'shift-c':'C', 'shift-d':'D', 'shift-e':'E', 'shift-f':'F', 'shift-g':'G', 
        'shift-h':'H', 'shift-i':'I', 'shift-j':'J', 'shift-k':'K', 'shift-l':'L', 
        'shift-m':'M', 'shift-n':'N', 'shift-o':'O', 'shift-p':'P', 'shift-q':'Q', 
        'shift-r':'R', 'shift-s':'S', 'shift-t':'T', 'shift-u':'U', 'shift-v':'V', 
        'shift-w':'W', 'shift-x':'X', 'shift-y':'Y', 'shift-z':'Z', 'shift-,':'<', 
        'shift-.':'>', 'shift-;':':', 
        'shift-quote':'"', 'shift-[':'{', 'shift-]':'}', 'shift-/':'?',
    };
    
    this.key_view_dict = {
        ' ':'&nbsp;',
        '>':'&gt;',
        '<':'&lt;',
    };
    
    this.commands = {};
    this.passive_commands = {};
    this.pushes = {};
    this.cancel_keybinding = 'control-g';

    this.pushes['control-x'] = '!push!';
    this.pushes['control-d'] = '!push!';
    this.pushes['esc'] = '!push!';
    this.pushes['alt-x'] = '!push_until!enter';

    this.commands[this.cancel_keybinding] = function(term) { term.command_cancel(); };
    this.commands['control-x control-v'] = function(term) { alert("Version 0.2 Kapture written by Graham Abbott <graham.abbott@gmail.com>"); };
    this.commands['test'] = function(term) { alert('testing!'); };
    this.commands['asdf'] = function(term) { return 'awesome'; };
    this.passive_commands['control-x control-n'] = function(term) { alert("this will not happen while focused on a textfield"); };

    this.history = [];
    this.command_stack = [];
};

Kapture.prototype.log = function(message) {
    console.log(message);
};

Kapture.prototype.keydown = function(event) {
    this.last_event = event;
    var modifier = '';
    this.stop_event = 0;
    
    if (event.shiftKey) {
        modifier += 'shift-';
    }
    if (event.altKey) {
        modifier += 'alt-';
    }
    if (event.ctrlKey) {
        modifier += 'control-';
    }
    if (event.metaKey) {
        modifier += 'meta-';
    }

    var name = this.keys_dict[event.keyCode];
    var guess = name;
    var full_modifier = modifier;

    if (this.command_stack.length && (modifier+guess) != this.cancel_keybinding) {
        full_modifier = this.command_stack.join(' ') + ' ' + modifier;
    }
    
    var mod_name = full_modifier + name;
    var result = null;

    if (this.capture_all) {
        if (mod_name == this.capture_final) {
            this.capture_all = false;
            var c = this.capture_buffer.join('');
            this.capture_buffer = [];
            if (this.commands[c] !== undefined) {
                result = this.commands[c](this);
            }
            event.preventDefault();
        } else {
            this.capture_buffer.push(mod_name);
            this.on_capture(mod_name);
            event.preventDefault();
            return;
        }
    }

    if (full_modifier || this.modified_dict[guess] !== undefined) {
        result = this.modified_dict[mod_name];
    }
    
    if (this.pushes[mod_name] !== undefined) {
        if (this.pushes[mod_name] == "!push!") {
            this.command_stack.push( modifier + name );
            this.on_push(modifier+name);
        } else if (this.pushes[mod_name].substring(0, 12) == "!push_until!") {
            this.capture_final = this.pushes[mod_name].substring(12);
            this.capture_all = true;
        }
        this.stop_event = 1;
    } else if (this.commands[mod_name] !== undefined) {
        this.command_stack = [];
        this.stop_event = 1;
        result = this.commands[mod_name](this);
    } else if (this.passive_commands[mod_name] !== undefined && this.passive_allowed()) {
        this.command_stack = [];
        this.stop_event = 1;
        result = this.passive_commands[mod_name](this);
    } else {
        this.command_stack = [];
    }

    if (result) {
        this.insert_at_cursor(result);
    }

    if (this.stop_event) {
        event.preventDefault();
    }
    last_guess = modifier + name;
};

Kapture.prototype.insert_at_cursor = function(guess) {
    // pass, do nothing here, you could over ride so that you can make a terminal or
    // faux text area if you wanted, i'm assuming that if they get here you just
    // want things to be passed on, basically this means the event will not be
    // stopped in anyway.
    this.log("press: " + guess);
};

Kapture.prototype.command_cancel = function() {
    this.command_stack = [];
    this.log('Cancelled!');
};

Kapture.prototype.add_command = function(key, func, doc) {
    this.commands[key] = func;
    this.documentation[key] = doc;
};

Kapture.prototype.add_passive_command = function(key, func, doc) {
    this.passive_commands[key] = func;
    this.documentation[key] = doc;
};

Kapture.prototype.on_push = function(key) {
    this.log("Push: " + key);
};

Kapture.prototype.on_capture = function(key) {
    this.log("Captured: " + this.capture_buffer.join('') + " - waiting for " + this.capture_final);
};

Kapture.prototype.show_help = function() {

};

Kapture.prototype.passive_allowed = function() {
    var t = document.activeElement.type;
    if (t == "textarea" || t == "text" || t == "password") {
        return false;
    } else { 
        return true;
    }
};