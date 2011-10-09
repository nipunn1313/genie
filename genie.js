/* Written by Graham Abbott <graham.abbott@gmail.com> */

/* 
   Genie - Javascript Templates that make your wishes come true.

   Quick Intro:
    Genie tries to emulate some of the more popular template libs, most notibly
    those similar to DjangoTemplates/Jinja. Additionally it supports some extra
    features that are somewhat unique to the challenges of templating in a web browser.
    
   Basics:
    var x = new Template("Hello my name is <<name>>.");
    assert x.render({'name':'Genie'}) == "Hello my name is Genie."

   Template Language Basics:
    The template language has operators wrapped in a outer operator. By default the outer
    operator is '<' and '>' but you can change this to whatever you want.

    The inner operators should stay the same, but switching the outer ones seems acceptible
    in scenarios where you want Genie to not conflict with other template libs (server side),
    or just look better.

    1. Variables
      Pure variable replacement simply works by doubling the outer operator:
        My name is <<name>>
      Simply define 'name' in the dictionary/object that you pass into the render method.

    2. Conditionals
      Most conditions that are available to javascript are available to Genie, the inner
      operator for conditions is '%'.

      <% if true %>
        Awesometown
      <% end %>
      
      All conditions end with just <% end %>, you can actually add any text you want after end
      it will simply be thrown away.

      <% if super_complex_query %>
        Do something
      <% else if something else %>
        Do something else
      <% end complex questions about life %>

    3. Javascript Execution
      Any time the inner operator ! is used it will simply execute the javascript in that block
      This is good if you are iterating over a list or just want to execute some javascript.
      This javascript will be executed at render time, not compile time.

      <! var name = 'Graham'; !>
      My name is << name >>.
      
    4. Comments
      Comments work just like any other language, but Genie only supports multi line so you
      have to close your comments.
      
      <# this is a comment #>
      
    5. Notes
      Notes are a rather special type. Basically templates have two stages:
        Uncompiled - Template has not been parsed
        Compiled   - Template has been parsed and is ready to render
      Compiled templates remove the "notes" blocks and append them to a list on the template
      object called "notes". This is great for when you may need to request some additional
      data before you actually do your render.

      This basically allows you to create you're own little meta language to interpret later.

      - template -
        <^ user_data ^>
        User's name is << username >>
      - end template -
      
      var t = new Template(<CONTENT FROM ABOVE>);
      t.pre_render();
      t.notes = [' user_data '];
      *** AJAX request for user data ***
      t.render( downloaded_user_data );

    6. Bindable (not HTML 5 data-binding)
      Bindable values are designed specially for web applications (the rest of Genie should
      work fine in almost any Javascript Environment). Bindable elements basically allow
      the developer to tag things (with a css class) so that later a single line of code
      will update the value across the page. 

      This section still needs some work, but the intent is to allow some variables on your
      page to be replaceable easily. By using something like <& value &> Genie will replace
      it with something like <span class='genie_update_value'>100</span> when the value is 100
      
      Using the set_bindable you can update the value of this span whenever you want. For
      now it's not wildly usable, however, with time it will mature into a better feature.

    7. Cleaning up whitespace
      Whitespace in templates can always be an issue, mostly because spacing can be very
      important. It's important to be able to layout

      Developers can add special characters to the front and back of Genie blocks.
      - slurp all whitespace until next newline (or until previous newline)
      | slurp all whitespace and the next new line (or until the previous newline)
      = slurp all whitespace until not whitespace (or until the previous non-whitespace)

    8. Compiler Directives
      One features that is really nice to have is related to having things that will change
      prior to actually rendering the template. This can be helpful if you are using genie
      in a place where you basically want multi-stage rendering of templates. This is
      a kind of non-standard feature for templates, but, well, genie is non-standard too.

      <~ if true ~>
        << value >>
      <~ end ~>
*/

var genie_context_begin;
var genie_context_end;

var GENIE_CONTEXT_begin = eval("genie_context_begin") || "<";
var GENIE_CONTEXT_end =   eval("genie_context_end") || ">";

var GENIE_CONTEXT_lookup = {
    "#":"comment",
    "%":"condition",
    "!":"exec",
    "&":"bindable",
    "^":"notes",
    "~":"compiler",
};

GENIE_CONTEXT_lookup[GENIE_CONTEXT_begin] = "variable";
GENIE_CONTEXT_lookup[GENIE_CONTEXT_end] = "variable";

var genie_environ_count = 0;

// I'm not really proud of this sort of monkey patching, but it's somewhat required here.
String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, "").replace(/^[\n|\r]+|[\n|\r]+$/g, ""); };
String.prototype.triml = function() { return this.replace(/^\s+/g, "").replace(/^[\n|\r]+/g, ""); };
String.prototype.trimr = function() { return this.replace(/\s+$/g, "").replace(/[\n|\r]+$/g, ""); };

String.prototype.trimr_spaces = function() { return this.replace(/[ |\t]+$/g, "") };
String.prototype.trimr_one = function()    { return this.replace(/\n[ |\t]*/g, "") };

String.prototype.triml_spaces = function() { return this.replace(/^[ |\t]+/g, "") };
String.prototype.triml_one = function()    { return this.replace(/^[ |\t]*\n/g, "") };


// Makes the code printouts very pretty ( can't help but keep it )
var pad = function(count) {
    var index = 0;
    var pad = "";
    while(index < count) {
        pad += "    ";
        index += 1;
    }
    return pad;
};

var Template = function(string) {
    this.orig_string = string;
    this.string = string;
    this.environment = null;
    this.blocks = [];
    this.final_func = null;
    this.parent_container = null;

    this.arg_list = [];

    this.notes = [];
};

Template.prototype.find_next_block = function() {
    var begin_char;
    var end_char;
    var cmd_lookup;

    var blocks = [];

    if (this.environment) {
        begin_char = this.environment.begin;
        end_char = this.environment.end;
        cmd_lookup = this.environment.lookup;
    } else {
        begin_char = GENIE_CONTEXT_begin;
        end_char = GENIE_CONTEXT_end;
        cmd_lookup = GENIE_CONTEXT_lookup;
    }
    
    var start = this.string.indexOf(begin_char);
    var next_char = start+1;
    
    if (start == -1) {
        var s = this.string;
        this.string = '';
        if (s == '') {
            return [];
        } else {
            blocks.push( ['text', s]);
            return blocks;
        }
    }
    
    var before_block = this.string.substring(0, start);
    var after_block = this.string.substring(start+1);
    
    blocks.push( ['text', before_block] ); 

    var start_char = after_block[0];
    var type = cmd_lookup[start_char];
    var end = null;

    if (start_char == begin_char) {
        end = after_block.indexOf(end_char + end_char);
    } else {
        if (start_char in cmd_lookup) {
            end = after_block.indexOf(start_char + end_char);
        } else {
            blocks.push( ['text', begin_char] );
            this.string = after_block.substring(0);
            return blocks;
        }
    }

    end += 1;

    var block = after_block.substring(1, end-1);
    after_block = after_block.substring(end+1);

    // Pre-inner-operator.
    if (block[0] == '-') {
        block = block.substring(1);
        if (blocks[blocks.length-1]) {
            blocks[blocks.length-1][1] = blocks[blocks.length-1][1].trimr_spaces();
        }
    } else if (block[0] == '=' || type == "notes") {
        block = block.substring(1);
        if (blocks[blocks.length-1]) {
            blocks[blocks.length-1][1] = blocks[blocks.length-1][1].trimr();
        }
    } else if (block[0] == '|') {
        block = block.substring(1);
    }
    
    //post inner operator.
    if (block[block.length-1] == '|') {
        block = block.substring(0, block.length-1);
        after_block = after_block.triml_one();
    } else if (block[block.length-1] == '-') {
        block = block.substring(0, block.length-1);
        after_block = after_block.triml_spaces();
    } else if (block[block.length-1] == '=') {
        block = block.substring(0, block.length-1);
        after_block = after_block.triml();
    }
    
    blocks.push( [type, block] );

    this.string = after_block;
    return blocks;
};

Template.prototype.bailout = function() {
    /* throw an exception and stop rendering a template */
    throw { type: "bailout", message: "bailout of current template render" };
};

Template.prototype.compile = function() {
    this.working_string = ""+this.orig_string;
    var counter_count = 0;
    var depth = 0;
    var f_code = ["\n"];
    var in_func = [];
    var i = 0;
    
    var blocks = this.find_next_block();
    
    while(blocks.length > 0) {
        for( i = 0; i < blocks.length; i++ ) {
            var obj = blocks[i];
            var type = obj[0];
            var data = obj[1];
        
            if (type == 'text') {
                f_code.push( pad(depth) );
                f_code.push("write(" + JSON.stringify(data) + ");\n" );
            } else if ( type == 'condition') {
                data = data.trim();

                if (data.substring(0,2) == 'if') {
                    var d = data.substring(2).trim();
                    var bulk = d;
                    if (d[0] == '(') {
                        bulk = d.substring(1, d.length-1);
                    }
                    f_code.push( "\n " + pad(depth) );
                    f_code.push("if (" + bulk + ")" + " {\n");
                    depth += 1;
                    in_func.push('}');
                } else if (data.substring(0, 5) == 'while') {
                    var d = data.substring(5).trim();
                    var bulk = d;
                    if (d[0] == '(') {
                        bulk = d.substring(1, d.length-2);
                    }
                    f_code.push( "\n " + pad(depth) );
                    f_code.push("while (" + bulk + ")" + " {\n");
                    depth += 1;
                    in_func.push('}');
                } else if (data.substring(0, 4) == 'ford') {
                    var d = data.substring(4).trim();
                    var bulk = d;
                    if (d[0] == '(') {
                        bulk = d.substring(1, d.length-2);
                    }
                
                    var value_name = bulk.substring(0, bulk.indexOf(' in '));
                    var rest = bulk.substring(bulk.indexOf(' in ') + 4);
                
                    var cvar = '_count_' + counter_count;
                    counter_count += 1;
                    f_code.push( "\n for( var " + value_name + " in " + rest + " ) {" );
                    f_code.push( "\n " + pad(depth) );
                    in_func.push('}');
                    depth += 1;                
                } else if (data.substring(0, 3) == 'for') {
                    var d = data.substring(3).trim();
                    var bulk = d;
                    if (d[0] == '(') {
                        bulk = d.substring(1, d.length-2);
                    }
                
                    var value_name = bulk.substring(0, bulk.indexOf(' in '));
                    var rest = bulk.substring(bulk.indexOf(' in ') + 4);
                
                    var cvar = '_count_' + counter_count;
                    counter_count += 1;
                    f_code.push( "\n for( var " + cvar + " = 0; " + cvar + " < " + rest + ".length; " + cvar + "++ ) {" );
                    f_code.push( "\n   var " + value_name + " = " + rest + "[" + cvar + "]; var index=" + cvar + ";");
                    f_code.push( "\n   var rindex = (" + rest + ".length" + " - index) - 1");
                    f_code.push( "\n " + pad(depth) );
                    in_func.push('}');
                    depth += 1;
                } else if (data == 'end') {
                    depth -= 1;
                    f_code.push( pad(depth) );
                    f_code.push(in_func.pop() + ';\n');
                } else if (data.substring(0, 4) == 'else' || data.substring(0, 7) == 'else if') {
                    f_code.push( pad(depth-1) );
                    f_code.push( "} " + data + " {\n");
                }
            } else if (type == 'variable') {
                f_code.push( pad(depth) );
                f_code.push( "write( " + data + " || undefined_variable('"+data+"') );\n");
            } else if (type == 'bindable') {
                var value = this.environment.bindable_dict[data.trim()];
                if (value === undefined) {
                    value = '';
                }
        
                f_code.push( "write( \"<span class='genie_" + this.environment.id + "_value_update_" + data.trim() + "'>\" + " + data + " + \"</span>\" );\n" );
            } else if (type == 'exec') {
                f_code.push(data);
            } else if (type == 'notes') {
                this.notes.push(data);
            } else if (type == 'compiler') {
                // this should have been compiled out, ignore in this case.
                // pass
            }
        }
        blocks = this.find_next_block();
    }

    var header = "var __exposed_vars = []; for (var a in v) { if (v.hasOwnProperty(a)) { __exposed_vars.push(a); } }";
    header += " with(v) { "; // this is the first time i've seen 'with' used and felt it was a good thing.
    this.f_code = f_code;
    this.f_code_render = "(function(parent, v, defaults, undefined_variable) { " + header + this.f_code.join(' ') + "}})";

};

Template.prototype.pre_render = function(undefined_variable) {
    this.compile();

    var _env = this.environment;
    var ____output = [];
    var partial = function(name, d) { return _env.render(name, d); };
    var write = function(ddd) { ____output.push(ddd); };
    var _template = this;
    var bailout = this.bailout;
    
    var compiled_code = eval(this.f_code_render);

    var encased_template = function(tvars, uv) {
        ____output = [];
        try {
            var template_vars = JSON.parse(tvars);
        } catch (e) {
            var template_vars = tvars;
        }

        var undef_var = function(name) {
            if (uv.indexOf('%s') == -1) {
                return uv.trim();
            } else {
                return uv.replace('%s', name.trim()).trim();
            }
        };

        var defaults;
        if (this.environment) {
            defaults = this.environment.default_dict;
        } else {
            defaults = {};
        }

        compiled_code(_template, template_vars, defaults, undef_var);
        return ____output.join('');
    }
    this.final_func = encased_template;
};

Template.prototype.render = function(variables, undefined_variable) {
    var start_time = new Date().valueOf();

    if (this.final_func == null) {
        this.pre_render(undefined_variable);
    }
    try {
        var result = this.final_func(variables, undefined_variable);
        console.log('render took: ' + (new Date().valueOf() - start_time));
        return result.trim();
    } catch (e) {
        if (e.type == 'bailout') {
            return null;
        } else {
            throw e;
        }
    }
};

Template.prototype.async_render = function(variables, options) {
    var undefined_variable = options['undefined_variable'];
    var on_success = options['on_success'];
    var on_error = options['on_error'];
    var on_bailout = options['on_bailout'];

    try {
        var result = this.render(variables, undefined_variable);
        if (result == null && on_bailout) {
            on_bailout(this);
            return;
        } else {
            if (on_success) {
                on_success(result, this);
            }
        }
    } catch (e) {
        on_error(e, this);
    }
};

var Environment = function() {
    this.id = genie_environ_count + 1;
    genie_environ_count += 1;
    this.default_data = {};
    this.object_dict = {};
    this.template_dict = {};
    this.bindable_dict = {};

    this.begin = GENIE_CONTEXT_begin;
    this.end = GENIE_CONTEXT_end;
    this.lookup = GENIE_CONTEXT_lookup;
};

Environment.prototype.template_list = function() {
    l = []; 
    for( var i in this.template_dict ) {
        l.push(i);
    }
    return l;
};

Environment.prototype.set_bindable = function(key, value) {
    this.bindable_dict[key] = value;

    var targets = document.getElementsByClassName('genie_' + this.id + '_value_update_' + key);
    for( var i = 0; i < targets.length; i++ ) {
        var obj = targets[i];
        obj.innerHTML = value;
    }
};

Environment.prototype.get_template = function(name) {
    return this.template_dict[name];
};

Environment.prototype.create_template = function(name, data) {
    var t = new Template(data);
    t.key = name;
    t.environment = this;
    this.template_dict[name] = t;
    return t;
};

Environment.prototype.render_quick = function(template_text, vars, undef_var) {
    var t = new Template(template_text);
    t.key = 'anon';
    t.environment = this;
    return t.render(vars, undef_var);
};

Environment.prototype.render = function(name, variables, undef_var) {
    try {
        var t = this.template_dict[name];
        try {
            return t.render(variables, undef_var);
        } catch (e) {
            return e;
        }
    } catch (e) {
        // buh wah?
    }
};

Environment.prototype.set_obj = function(name, obj) {
    this.object_dict[name] = obj;
};

Environment.prototype.get_obj = function(name) {
    return this.object_dict[name];
};

var main_environment = new Environment();

var fs = function( s, args ) {
    var t = new Template(s);
    return t.render(args);
};

var ts = function() {
    var d = new Date();
    return d.getTime() / 1000.0;
};

var genie_render_dom_element = function(d, o) {
    var content = d.value;
    var t = new Template(content);
    d.value = t.render(o);
}

var loadr = function(url) {
    var d = document.createElement('script');
    d.src = url;
    d.type = 'text/javascript';
    document.body.appendChild(d);
};

var monkey_patch = function() {
    String.prototype.render = function(args, undef_var) {
	var t = new Template(this);
	t.key = 'anon';
	return t.render(args, undef_var);
    };
};

var TestSuite = function(note) {
    this.note = note;
    this.passes = Array();
    this.fails = Array();
};

TestSuite.prototype.assertEqual = function(val1, val2, add_note) {
    if (val1 == val2) {
        this.passes.push(add_note);
    } else {
        this.fails.push( [add_note, '!=', val1, val2]);
    }
};

TestSuite.prototype.assertNotEqual = function(val1, val2, add_note) {
    if (val1 != val2) {
        this.passes.push(add_note);
    } else {
        this.fails.push( [add_note, '==', val1, val2]);
    }
};

var run_tests = function() {
    var suite = new TestSuite('tests!');

    // start writing tests here

    var t = new Template("My name is <<name>>");
    suite.assertEqual( t.render({'name':'Genie'}), "My name is Genie", "basic genie render" );
    suite.assertEqual( t.render({'name':'asdf'}),  "My name is asdf", "basic genie render 2" );

    var t2 = new Template("<% if true %>Test<% end %>asdf");
    suite.assertEqual( t2.render({}), "Testasdf", "condition test 1" );
    
    var t3 = new Template("        <% if true %>Test   <% end %>");
    suite.assertEqual( t3.render({}), "Test", "condition test" );

    var t4 = new Template("this is a test<! bailout(); !>");
    suite.assertEqual( t4.render({}), null, "Bailout Test");

    // finish writing tests here

    return [suite.passes, suite.fails];
};

var run_tests_simple = function() {
    results = run_tests();
    if (results[1].length) {
        return false;
    }
    return true;
};

var run_tests_debug = function() {
    results = run_tests();
    for(var i=0; i < results[0].length; i++) {
        console.log( 'PASS: ' + results[0][i] );
    }
    for(var i=0; i < results[1].length; i++) {
        var o = results[1][i];
        console.log(o);
        console.log( 'FAIL: (' + o[0] + ') -> ' + JSON.stringify(o[2]) + ' ' + o[1] + ' ' + JSON.stringify(o[3]) );
    }
};

try {
    exports.Template = Template;
    exports.Environment = Environment;
    exports.monkey_patch = monkey_patch;
    exports.env = main_environment;
} catch (e) {
    var genie = {};
    genie.Template = Template;
    genie.Environment = Environment;
    genie.monkey_patch = monkey_patch;
    genie.env = main_environment;
    genie.fs = fs;
}

