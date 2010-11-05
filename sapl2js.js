var fs      = require("fs"),
    util    = require("util");

var sapl2js = function () {
    var D       = "[0-9]",
        E       = "(?:" + "[Ee]" + "[+\\-]" + "?" + D + "+" + ")",
        L       = "[A-Z_a-z]",
        CONST   = "\\|\\||&&|==|!=|<=|>=|<<|>>" + "|"
                + "[?|^&<>+\\-*/%~!]" + "|"
                + "0[Xx]" + "[0-9A-Fa-f]" + "+" + "|"
                + "0" + "[0-7]" + "+" + "|"
                + D + "+" + E + "?" + "|"
                + D + "*" + "\\." + D + "+" + E + "?" + "|"
                + D + "+" + "\\." + D + "*" + E + "?" + "|"
                + "\"" + "(?:" + "[^\\\\\"]" + "|" + "\\\\." + ")" + "*" + "\"",
        IDENT   = L + "(?:" + L + "|" + D + ")" + "*",
        PATTERN = "letrec" + "|" + "let" + "|" + "=" + "(?!" + "=" + ")" + "|"
                + "in" + "|" + "->" + "|" + "[,\\\\'()]" + "|"
                + "(" + CONST + ")" + "|"
                + "(" + IDENT + ")" + "|"
                + "(" + "\\n" + ")" + "|"
                + "(" + "\\S" + "+" + ")",
        REGEXP  = new RegExp(PATTERN, "g");

    function lex(str) {
        var tokens  = [],
            line    = 1;

        str.replace(REGEXP, function (str, p1, p2, p3, p4) {
            if (p4)
                throw "Invalid token '" + p4 + "' "
                    + "on line " + line;
            else if (p3)
                ++line
            else {
                tokens.push({
                    type    : p2 ? "ident" : p1 ? "const" : str,
                    text    : str,
                    line    : line
                });
            }
        });
        tokens.push({
            type    : "eof",
            text    : "",
            line    : line
        });
        return tokens;
    }

    function parse(tokens) {
        var token = tokens.reverse().pop();

        function accept(type) {
            var node;

            if (token.type == type) {
                node    = token;
                token   = tokens.pop();
                return node;
            }
            return false;
        }

        function expect(type) {
            var node;

            if (node = accept(type))
                return node;
            throw "Unexpected token '" + token.text + "' "
                + "with type <" + token.type + "> "
                + "on line " + token.line + " "
                + "(expected type <" + type + ">)"; 
        }

        function atom() {
            var atom;

            if (atom = accept("ident") || accept("const"))
                return atom;
            else if (accept("(")) {
                atom = expr();
                expect(")");
                return atom;
            } else
                throw "Unexpected token '" + token.text + "' "
                    + "with type " + token.type + " "
                    + "on line " + token.line + " "
                    + "(expected type <ident>, <const>, or <(>)";
        }

        function app() {
            var app = atom();

            while (["letrec", "let", "\\",
                    "const", "ident", "("].some(function (type) {
                return token.type == type;   
            }))
                app = {
                    type    : "@",
                    fun     : app,
                    arg     : atom()
                };
            return app;                
        }

        function param() {
            return {
                type    : "param",
                strict  : accept("'") ? true : false,
                name    : expect("ident")
            };
        }

        function fun() {
            var fun;

            if (fun = accept("\\")) {
                var params = [];

                while (token.type != "->")
                    params.push(param());
                fun.params = params;
                expect("->");
                fun.body = expr();
                return fun;
            } else
                return app();
        }

        function def() {
            var name    = expect("ident"),
                params  = [],
                def;

            while (token.type != "=")
                params.push(param());
            def         = expect("=");
            def.name    = name;
            def.bind    = params.length > 0 ? {
                type    : "\\",
                params  : params,
                body    : expr()
            } : expr();
            return def;
        }

        function expr() {
            var let;

            if (["letrec", "let"].some(function (type) {
                return let = accept(type);
            })) {
                var defs = [];

                do
                    defs.push(def());
                while (accept(","));
                let.defs = defs;
                expect("in");
                let.expr = expr();
                return let;
            } else
                return fun();
        }

        return expr();
    }

    function code(node) {
        var symtab = [];

        function resolve(node) {
            if (node.type == "ident") {
                function resolve(node) {
                    var sym;

                    for (var i = symtab.length - 1; i >= 0; --i) {
                        sym = symtab[i];
                        if (sym.name.text == node.text) 
                            break;
                    }
                    if (i < 0)
                        throw "Reference to undefined symbol '" + node.text + "' "
                            + "on line " + node.line;
                    if (sym.bind.type == "ident")
                        sym.bind = resolve(sym.bind);
                    return sym.bind;
                }

                return resolve(node);
            } else
                return node;
        }

        function wrap(node) {
            with (resolve(node)) switch (type) {
            case "\\":
                if (params.some(function (param) {
                    return param.strict;
                })) {
                    var body = node;
                
                    params.forEach(function (param) {
                        body = {
                            type    : "@",
                            fun     : body,
                            arg     : param.name
                        };
                    });
                    return {
                        type    : "\\",
                        params  : params.map(function (param) {
                            return {
                                type    : "param",
                                strict  : false,
                                name    : param.name
                            };
                        }), body : body
                    };
                } else
                    return node;
            default:
                return node;
            };
        }

        function code(node, strict) {
            with (node) switch (type) {
            case "letrec": case "let":
                var str;

                defs.forEach(function (def) {
                    symtab.push({
                        name    : def.name,
                        bind    : def.bind
                    });
                });
                str = defs.reduce(function (str, def) {
                    return str + code(def) + "\n";
                }, "(function(){") + "return(" + code(wrap(expr), true) + ")})()";
                defs.forEach(function (def) {
                    symtab.pop();
                });
                return str;
            case "=":
                return "var " + code(name) + "=" + code(bind) + ";";
            case "\\":
                var str;

                params.forEach(function (param) {
                    symtab.push({
                        name    : param.name,
                        bind    : param
                    });
                });
                str = "(function(" + params.map(code) + "){return(" + code(wrap(body), true) + ");})";
                params.forEach(function (param) {
                    symtab.pop();
                });
                return str;
            case "param":
                return code(name);
            case "@":
                var args = [];

                for (; node.fun; node = node.fun)
                    args.push(node.arg);
                args.reverse();
                with (node) switch (text) {
                case "~": case "!":
                    if (args.length > 1) 
                        throw "";
                    return text + "(" + code(args[1], true) + ")";
                case "||": case "&&": case "==": case "!=":
                case "<=": case ">=": case "<<": case ">>":
                case "|": case "^": case "&": case "<": case ">":
                case "+": case "-": case "*": case "/": case "%":
                    if (args.length < 2)
                        throw "";
                    if (args.length > 2)
                        throw "";
                    return "(" + code(args[0], true) + ")" + text
                         + "(" + code(args[1], true) + ")";
                case "?":
                    if (args.length < 3)
                        throw "";
                    if (args.length > 3)
                        throw "";
                    return "(" + code(args[0], true) + ")" + "?"
                         + "(" + code(args[1]) + ")" + ":"
                         + "(" + code(args[2]) + ")";
                default:
                    args = args.map(wrap);
                    if (strict) {
                        var params = resolve(node).params;

                        str = code(node);
                        if (params) {
                            var length = params.length;

                            if (length <= args.length) {
                                var prefix = args.splice(0, length);

                                for (var i = 0; i < length; ++i) 
                                    prefix[i] = code(prefix[i], params[i].strict);
                                str = str + "(" + prefix + ")";
                            }
                        }
                    } else
                        str = code(wrap(node));
                    if (args.length > 0) {
                        str = "[" + str + "," + "[" + args.map(function (arg) { return code(arg, false); }) + "]" + "]";
                        if (strict)
                            str = "sapl2js.eval(" + str + ")";
                    }
                    return str;
                };
            case "ident":
                var str = node.text;

                if (strict && !resolve(node).strict)
                    return "sapl2js.eval(" + str + ")";
                return str;
            case "const":
                return node.text;
            };
        }

        return code(node, true);
    }

    var PRELUDE = "\
        add 'a 'b   = + a b,\
        sub 'a 'b   = - a b\
    ";

    function sapl2js(sapl) {
        return code(parse(lex("letrec " + PRELUDE + " in " + sapl)));
    };

    sapl2js.eval = function (expr) {
        if (typeof(expr) == "object") {
            if (expr.length == 1) 
                return expr[0];
            if (typeof(expr[0]) == "object") {
                var y = this.eval(expr[0]);

                if (typeof(y) == "object") {
                    expr[0] = y[0];
                    if (y.length != 1)
                        expr[1] = y[1].concat(expr[1]);
                } else
                    expr[0] = y;            
            } else {
                var f   = expr[0],
                    xs  = expr[1];

                if (f.length == xs.length) {
                    var y = f.apply(null, xs);

                    if (typeof(y) == "object") {
                        expr[0] = y[0]; 
                        if (y.length == 1)
                            expr.length = 1;
                        else
                            expr[1] = y[1];
                    } else {
                        expr[0]     = y;
                        expr.length = 1;
                    }
                } else if (f.length < xs.length) {
                    var y = f.apply(null, xs.splice(0, f.length));

                    if (typeof(y) == "object") {
                        expr[0] = y[0];
                        if (y.length != 1)
                            expr[1] = y[1].concat(xs);
                    } else
                        expr[0] = y;            
                } else
                    return expr;
            }
            return this.eval(expr);
        } else 
            return expr;
    };

    return sapl2js;
}();

str = sapl2js(fs.readFileSync(process.argv[2]).toString());

util.puts(str);
util.puts(eval(str));
