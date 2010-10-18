Coder = new function() {
    var symtab = [];

    function resolve(node) {
        if (node.type != "ident")
            return node;
        for (var i = symtab.length - 1; i >= 0; --i) {
            var sym = symtab[i];

            if (sym.name.text == node.text)
                return resolve(sym.bind);
        }
        throw "Reference to undefined symbol " + node.text;
    }

    function wrap(node) {
        with (resolve(node))
            switch (type) {
            case "\\":
                var body;

                if (!params.some(function (param) {
                    return param.strict;
                }))
                    return node;
                body = node;
                params.forEach(function (param) {
                    body = {
                        type : "@",
                        fun  : body,
                        arg  : param.name
                    };
                });
                return {
                    type     : "\\",
                    params   : params.map(function (param) {
                        return {
                            type   : "param",
                            strict : false,
                            name   : param.name
                        };
                    }), body : body
                };
            default:
                return node;
            }
    }

    function code(node, strict) {
        if (!node)
            alert("poof");
        with (node) 
            switch (type) {
            case "let":
            case "letrec":
                defs.forEach(function (def) {
                    symtab.push(def);
                });
                res = "function " + "(" + ")" + "{" +
                    code(defs) +
                    
                    "return " + code(expr, true) + ";" +
                "}" + "(" + ")";
                defs.forEach(function (def) {
                    symtab.pop();
                });
                return res;
            case "defs":
                return node.map(code).join("");
            case "=":
                var res = code(bind);

                if (bind.type == "\\") {
                    var index = -1;

                    for (node = bind.body; node.type == "@"; node = node.fun)
                        --index;
                    if (node.type == "ident" 
                            && bind.params.some(function (param) {
                        ++index;
                        return param.name.text == node.text;
                    }) && index >= 0)
                        res = "function " + "(" + ")" + "{" +
                            "var " + "fun" + "=" + res + ";" +

                            "fun.index" + "=" + index + ";" +
                            "return " + "fun" + ";" +
                        "}" + "(" + ")";
                }
                return "var " + code(name) + "=" + res + ";\n";
            case "\\":
                var res;

                params.forEach(function(param) {
                    symtab.push({
                        name : param.name, 
                        bind : param
                    });
                });
                res = "function " + "(" + params.map(code) + ")" + "{" +
                    "return " + code(body, true) + ";" +
                "}";
                params.forEach(function (param) {
                    symtab.pop();
                });
                return res;
            case "param":
                return code(node.name);
            case "?":
                return "(" + code(pred, true) + ")" + "?" +
                       "(" + code(lhs, true)  + ")" + ":" +
                       "(" + code(rhs, true)  + ")";
            case "#":
                return "(" + code(lhs, true) + ")" + text +
                       "(" + code(rhs, true) + ")";
            case "select":
                var res = "";

                for (var i = 0; i < args.length; ++i) {
                    var arg = args[i];

                    res += "case " + i + ":";
                    if (arg.type == "\\") {
                        var params = arg.params;

                        params.forEach(function(param) {
                            symtab.push({
                                name    : param.name,
                                bind    : param
                            });
                        });
                        res += params.reduce(function (acc, param, index) {
                            var res = "_[1][" + index + "]";
                          
                            if (param.strict)
                                res = "Sapl.eval" + "(" + res + ")"; 
                            return acc + "var " + code(param.name) + "=" + res + ";";
                        }, "");
                        res += "return " + code(arg.body, true) + ";";
                        params.forEach(function (param) {
                            symtab.pop();
                        });
                    } else
                        res += "return " + code(arg) + ";";
                }
                return "function " + "(" + ")" + "{" +
                    "var " + "_" + "=" + code(fun, true) + ";" +
                    "switch " + "(" + "(_[0] || _).index" + ")" + "{" +
                        res +
                    "}" + 
                "}" + "(" + ")";
                return res;
            case "@":
                var head = [],
                    tail = [],
                    params;

                for (; node.fun; node = node.fun) 
                    tail.push(node.arg);
                params = resolve(node).params;
                if (params) {
                    params.forEach(function (param) {
                        var arg;

                        arg = tail.pop();
                        if (arg)
                            head.push(code(wrap(arg), param.strict));
                    });
                }
                tail = tail.reverse().map(wrap).map(code);
                res = code(node);
                if (strict && params && params.length <= head.length) {
                    res = res + "(" + head.join() + ")";
                } else
                    tail = head.concat(tail);
                if (tail.length > 0) {
                    res = "[" + res + "," + "[" + tail.join() + "]" + "]";
                    if (strict)
                        res = "Sapl.eval" + "(" + res + ")";
                }
                return res;
            case "const":
                return node.text;
            case "ident":
                var res = node.text;

                if (strict && !resolve(node).strict) 
                    return "Sapl.eval" + "(" + res + ")";
                return res;
            }
    }

    this.code = code;
}();
