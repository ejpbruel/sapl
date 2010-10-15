Coder = new function() {
    var binds = new Object();

    function resolve(node) {
        var bind;

        if (node.type == "ident") {
            function resolve(node) {
                bind = binds[node.text];
                if (!bind)
                    throw "Unable to resolve identifier " + node.text;
                if (resolve.type == "ident")
                    return binds[node.text] = resolve(bind)
                else
                    return bind;
            }

            return resolve(node);
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

    function wrap(node) {
        var body;

        if (node.type == "\\") {
            params = node.params;
            if (!params.some(function (param) {
                return param.strict;
            }))
                return node;
            body = node;
            params.forEach(function (param) {
                body = {
                    type    : "@",
                    fun     : body,
                    arg     : param.name
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
        } else if (node.type == "?") {
            return {
                type    : "?",
                cond    : node.cond,
                lhs     : wrap(node.lhs),
                rhs     : wrap(node.rhs)
            };
        } else
            return node;
    }

    function code(node, strict) {
        var res,
            index,
            head,
            tail,
            params;
       
        with (node) 
            switch (type) {
            case "defs":
                return node.map(code).join("");
            case "=":
                res = code(bind);
                if (bind.type == "\\") {
                    index = -1;
                    for (node = bind.body; node.type == "@"; node = node.fun)
                        --index;
                    if (node.type == "ident" && bind.params.some(function (param) {
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
                defs.forEach(function (def) {
                    binds[def.name.text] = def.bind;
                });
                res = "function " + "(" + ")" + "{" +
                    code(defs) +
                    
                    "return " + code(wrap(expr), true) + ";" +
                "}" + "(" + ")";
                defs.forEach(function (def) {
                    delete binds[def.name.text];
                });
                return res;
            case "\\":
                params.forEach(function(param) {
                    binds[param.name.text] = param;
                });
                res = "function " + "(" + params.map(code) + ")" + "{" +
                    "return " + code(wrap(body), true) + ";" +
                "}";
                params.forEach(function (param) {
                    delete binds[param.name.text];
                });
                return res;
            case "param":
                return code(node.name);
            case "?":
                return "(" + force(pred) + ")" + "?" +
                       "(" + force(lhs)  + ")" + ":" +
                       "(" + force(rhs)  + ")";
            case "#":
                return "(" + force(lhs) + ")" + text +
                       "(" + force(rhs) + ")";
            case "@":
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
                return node.text;
            }
    }

    this.code = code;
}();
