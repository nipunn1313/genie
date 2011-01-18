var Terminal = function(root) {
    this.env = new genie.Environment();
    this.reset();
    if (root) {
        this.initialize(root);
        this.refresh();
    }
}

Terminal.prototype.initialize = function(root) {
    this.root = root;
    console.log("Initializeing " + this);
    
    this.keys_dict = {"48": "0", "49": "1", "50": "2", "51": "3", "52": "4", "53": "5", "54": "6", "55": "7", 
                      "56": "8",  "57": "9", "65": "a", "66": "b", "67": "c", "68": "d", "69": "e", 
                      "70": "f", "71": "g", "72": "h", "73": "i", "74": "j", "75": "k", "76": "l", "77": "m", 
                      "78": "n", "79": "o", "80": "p", "81": "q", "82": "r", "83": "s", "84": "t", "85": "u", "86": 
                      "v", "87": "w", "88": "x", "89": "y", "90": "z", "186": ";", "187": "=", "188": ",", 
                      "189": "-", "190": ".", "191": "/", "192": "`", "219": "[", "220": "\\", "221": "]", "222": "'",
                      "229": "q", "9":"tab", "27":"esc", 
                      "32":"space", "8":"backspace", "13":"enter", '229':'q',
		      '37':'left', '38':'up', '39':'right', '40':'down',
		      
                      };

    this.modified_dict = {
        "shift-1":"!", "shift-2":"@", 'shift-3':'#', 'shift-4':'$', 'shift-5':'%',
        'shift-6':'^', 'shift-7':'&', 'shift-8':'*', 'shift-9':'(', 'shift-0':')',
        'shift--':'_', 'shift-=':'+', 'shift-`':'~',

        'shift-a':'A',     'shift-b':'B',     'shift-c':'C',     'shift-d':'D',     'shift-e':'E', 
        'shift-f':'F',     'shift-g':'G',     'shift-h':'H',     'shift-i':'I',     'shift-j':'J', 
        'shift-k':'K',     'shift-l':'L',     'shift-m':'M',     'shift-n':'N',     'shift-o':'O', 
        'shift-p':'P',     'shift-q':'Q',     'shift-r':'R',     'shift-s':'S',     'shift-t':'T', 
        'shift-u':'U',     'shift-v':'V',     'shift-w':'W',     'shift-x':'X',     'shift-y':'Y',
        'shift-z':'Z',     'shift-,':'<',     'shift-.':'>',

        'shift-;':':', 'shift-quote':'"', 'shift-[':'{', 'shift-]':'}', 'shift-/':'?',

    }
    
    this.key_view_dict = {
        ' ':'&nbsp;',
        '>':'&gt;',
        '<':'&lt;'
    }

    this.genie_buffer_template = "{% for line in v.lines %}<div class='genie-terminal-line{% if v.current_line == index %} genie-terminal-current-line" +
                                 "{% end %}' id='{{index}}'>{% if v.current_line == index %}{{ v.prompt }}{% end %}{! var line_number = index; !}" +
                                 "{% for char in (line + ' ') %}{! if (v.key_view_dict[char] !== undefined) { char = v.key_view_dict[char] } !}" +
                                 "{% if index == v.cursor_loc && line_number == v.current_line %}" +
                                 "<span id='genie-cursor' style='background-color: #66b;'>{{char}}</span>{% else %}{{char}}{% end %}{% end %}</div>{% end %}";

    //this.keys_dict['8'] = function(term) { term.command_backspace(); }
    //this.keys_dict['46'] = function(term) { term.command_delete(); }
    //this.keys_dict['32'] = function(term) { term.insert_at_cursor(' '); }
    //this.keys_dict['37'] = function(term) { term.move_cursor_left(); }
    //this.keys_dict['38'] = function(term) { term.move_cursor_up(); }
    //this.keys_dict['39'] = function(term) { term.move_cursor_right(); }
    //this.keys_dict['40'] = function(term) { term.move_cursor_down(); }
    
    this.modified_dict['control-g'] = function(term) { term.command_cancel(); }
    this.modified_dict['control-x'] = '!push!';
    this.modified_dict['control-x control-n'] = "Graham";
    this.modified_dict['control-l'] = function(term) { term.refresh(); }
    this.modified_dict['control-e'] = function(term) { term.cursor_location = term.lines[term.current_line].length;    }
    this.modified_dict['control-a'] = function(term) { term.cursor_location = 0; }
    this.modified_dict['control-p'] = function(term) { term.move_cursor_up(); }
    this.modified_dict['control-n'] = function(term) { term.move_cursor_down(); }
    this.modified_dict['control-f'] = function(term) { term.move_cursor_right(); }
    this.modified_dict['control-b'] = function(term) { term.move_cursor_left(); }
    this.modified_dict['control-d'] = function(term) { term.command_delete(); }
    this.kill_ring = [];
    this.modified_dict['control-k'] = function(term) { term.command_kill(); }
    this.modified_dict['control-y'] = function(term) { term.command_yank(); }
    this.modified_dict['alt-y'] = function(term) { term.command_reyank(); }
    
    // Lots of work to do here.
    this.modified_dict['meta-r'] = function(term) {
        if (confirm("Are you sure you want to reload?")) {
            document.location.reload();
        }
    }
    this.modified_dict['control-x control-r'] = function(term) {
        document.location.reload();
    }
            
    this.env.create_template('genie-buffer-template', this.genie_buffer_template);
    
    this.buffer = document.createElement('div');
    this.below = document.createElement('div');
    this.error_log = document.createElement('div');
    this.error_log.style.cssText = 'position: absolute; padding: 10px; width: 300px; height: 50px; font-size: 14px; background-color: #444; bottom: 10px; right:10px; border: 1px #999;';
    
    this.root.appendChild(this.buffer);
    this.root.appendChild(this.below);
    //this.root.appendChild(this.error_log);

    this.history = [];
    this.command_stack = [];
    this.log("Testing Log");
}

Terminal.prototype.get_current_line = function() {
    return this.lines[this.current_line];
}

Terminal.prototype.in_place_edit = function( obj ) {
    var lines = obj.innerHTML.split("\n");
    obj.innerHTML = '';
    this.initialize(obj);
    this.lines = lines;
    this.refresh();
}

Terminal.prototype.log = function(message) {
    //this.error_log.innerHTML = message;
    console.log(message);
}

Terminal.prototype.refresh_line = function() {
    this.refresh();
}

Terminal.prototype.refresh = function() {
    this.end_buffer_index = this.lines.length;
    
    if (this.current_line >= this.lines.length) {
        this.current_line = this.lines.length - 1;
    }
    if (this.current_line < 0) {
        this.current_line = 0;
    }
    if (this.cursor_location >= this.lines[this.current_line].length) {
        this.cursor_location = this.lines[this.current_line].length;
    }
    if (this.cursor_location < 0) {
        this.cursor_location = 0;
    }
    this.buffer.innerHTML = this.env.render('genie-buffer-template', {'lines':this.lines.slice(this.start_buffer_index, this.end_buffer_index), 
                                            'current_line':this.current_line, 'cursor_loc':this.cursor_location, 'prompt':this.prompt, 'key_view_dict':this.key_view_dict});
    this.focus();
}

Terminal.prototype.reset = function() {
    this.lines = [''];
    this.start_buffer_index = 0;
    this.end_buffer_index = 0;
    this.current_line = 0;
    this.cursor_location = 0;
    this.prompt = '';
}

Terminal.prototype.focus = function() {
    //window.scrollTo(0, document.getElementById('genie-cursor').getPosition().y);
}

Terminal.prototype.keydown = function(event) {
    last_event = event;
    var modifier = '';
    
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

    if (event.keyCode == 16 || event.keyCode == 17 || event.keyCode == 18 || event.keyCode == 91) {
        this.refresh_line();
        return;
    }
    
    var name = this.keys_dict[event.keyCode];
    var key = this.keys_dict[event.keyCode];
    var guess = key;
    var full_modifier = modifier;
    
    if (typeof guess == 'function' && !modifier) {
        try {
            guess = guess(this);
        } catch (e) {
            this.log(e);
        }
    }
    
    if (this.command_stack.length && (modifier+guess) != 'control-g') {
        full_modifier = this.command_stack.join(' ') + ' ' + modifier;
    } 
    
    if (full_modifier || this.modified_dict[guess] !== undefined) {
        var mod_name = full_modifier + name;
        guess = this.modified_dict[mod_name];

        if (typeof guess == 'function') {
            guess = guess(this);
            if (guess == undefined) {
                guess = '';
            }

        }

        if (guess == '!push!') {
            this.command_stack.push( modifier + key );
        } else {
            this.command_stack = [];
            if (guess != undefined) {
                this.insert_at_cursor(guess);
            } else {
                this.log(full_modifier + name + ' is not defined. <br>(' + mod_name +') ['+event.keyCode+']');
            }
        }
    } else {
        if (guess != undefined) {
            this.insert_at_cursor(guess);
        } else { 
            //this.log('Could not find: ' + event.keyCode);
        }
    }

    console.log('key: ' + guess);

    this.refresh();
    event.stopPropagation();
}

Terminal.prototype.insert_at_cursor = function(data) {
    if (data == undefined) {
        return;
    }
    if (data.length == 0) {
        return;
    }
    var line = this.lines[this.current_line];
    var pre = line.substring(0, this.cursor_location);
    var post = line.substring(this.cursor_location, line.length);
    this.lines[this.current_line] = pre + data + post;
    this.cursor_location += data.length;
}

Terminal.prototype.command_backspace = function() {
    var line = this.lines[this.current_line];
    var pre = line.substring(0, this.cursor_location-1);
    var post = line.substring(this.cursor_location, line.length);
    this.lines[this.current_line] = pre + post;
    this.cursor_location -= 1;
    
    if (this.cursor_location == -1) {
        // Get rid of this line.
        var line = this.lines[this.current_line];
        var pre_line = this.lines.slice(0, this.current_line);
        var post_line = this.lines.slice(this.current_line+1, this.lines.length);
        if (this.current_line != 0) {
            this.lines = pre_line.concat(post_line);
            this.current_line -= 1;
            this.cursor_location = this.lines[this.current_line].length;
            this.lines[this.current_line] += line;
        }
    }
}

Terminal.prototype.move_cursor_right = function() { this.cursor_location += 1; }
Terminal.prototype.move_cursor_left = function() { this.cursor_location -= 1; }
Terminal.prototype.move_cursor_up = function() { this.current_line -= 1; }
Terminal.prototype.move_cursor_down = function() { this.current_line += 1; }

Terminal.prototype.command_space = function() {
    this.input_buf += " ";
    this.refresh_line();
}

Terminal.prototype.command_cancel = function() {
    this.command_stack = [];
    this.refresh_line();
    this.log('Cancelled!');
}

Terminal.prototype.command_delete = function() {
    var line = this.lines[this.current_line];

    if (this.cursor_location == line.length) {
        this.log('here');
        // Get rid of this line.
        var line = this.lines[this.current_line+1];
        var pre_line = this.lines.slice(0, this.current_line+1);
        var post_line = this.lines.slice(this.current_line+2, this.lines.length);
        if (this.current_line != 0) {
            this.lines = pre_line.concat(post_line);
            this.cursor_location = this.lines[this.current_line].length;
            this.lines[this.current_line] += line;
        }
    } else {
        var pre = line.substring(0, this.cursor_location);
        var post = line.substring(this.cursor_location+1, line.length);
        this.lines[this.current_line] = pre + post;
    }
}
