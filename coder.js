Coder = new function() {
    var symtab = [];

    function resolve(node) {
        var i,
            sym;

        if (node.type != "ident")
            return node;
        for (i = symtab.length - 1; i >= 0; --i) {
            sym = symtab[i];
            if (sym.name.text == node.text)
                return resolve(sym.bind);
        }
        throw "Reference to undefined symbol " + node.text;
    }

    function wrap(node) {
        var body;

        if (node.type == "\\") {
            body = node;
            node.params.forEach(function (param) {
                body = {
                    type : "@",
                    fun  : body,
                    arg  : param.name
                };
            });
            return {
                type     : "\\",
                params   : node.params.map(function (param) {
                    return {
                        type   : "param",
                        strict : false,
                        name   : param.name
                    };
                }), body : body
            };
        } else
            return node;
    }

    function force(node) {
        if (node.type == "@") 
            return code(node, true);
        else if (node.type == "ident" && !resolve(node).strict) 
            return "Sapl.eval" + "(" + code(node) + ")";
        else
            return code(node);
    }

    function code(node, strict) {
        var res,
            index,
            i, j,
            arg,
            params,
            head,
            tail;
       
        with (node) 
            switch (type) {
            case "defs":
                alert("defs");
                return node.map(code).join("");
            case "=":
                alert("=");
                alert("coding " + name.text);
                res = code(bind);
                if (bind.type == "\\") {
                    index = -1;
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
            case "let":
            case "letrec":
                alert("letrec");
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
            case "\\":
                alert("\\");
                params.forEach(function(param) {
                    symtab.push({
                        name : param.name, 
                        bind : param
                    });
                });
                res = "function " + "(" + params.map(code) + ")" + "{" +
                    "return " + code(wrap(body), true) + ";" +
                "}";
                params.forEach(function (param) {
                    symtab.pop();
                });
                return res;
            case "param":
                alert("param");
                return code(node.name);
            case "?":
                alert("?");
                return "(" + force(pred) + ")" + "?" +
                       "(" + force(lhs)  + ")" + ":" +
                       "(" + force(rhs)  + ")";
            case "#":
                alert("#");
                return "(" + force(lhs) + ")" + text +
                       "(" + force(rhs) + ")";
            case "select":
                alert("select");
                res = "";
                for (i = 0; i < args.length; ++i) {
                    res += "case " + i + ":";
                    arg = args[i];
                    if (arg.type == "\\") {
                        params = arg.params;
                        for (j = 0; j < params.length; ++j) 
                            res += "var " + code(params[j].name) 
                                    + "=" + "_[1]" + "[" + j + "]" + ";";
                        params.forEach(function(param) {
                            symtab.push({
                                name    : param.name,
                                bind    : param
                            });
                        });
                        res += "return " + code(arg.body) + ";";
                        params.forEach(function (param) {
                            symtab.pop();
                        });
                    } else
                        res += "return " + code(arg) + ";";
                }
                return "function " + "(" + ")" + "{" +
                    "var " + "_" + "=" + force(fun) + ";" +
                    "switch " + "(" + "(_[0] || _).index" + ")" + "{" +
                        res +
                    "}" + 
                "}" + "(" + ")";
                return res;
            case "@":
                alert("@");
                head = [];
                tail = [];
                for (; node.fun; node = node.fun) 
                    tail.push(node.arg);
                params = resolve(node).params;
                if (params) {
                    params.forEach(function (param) {
                        var arg;

                        arg = tail.pop();
                        if (arg)
                            head.push((param.strict ? force : code)(wrap(arg)));
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
            case "ident":
                alert("ident " + node.text);
                return node.text;
            }
    }

    this.code = code;
}();
