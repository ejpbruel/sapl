Coder = new function() {
    var binds = new Object();

    function resolve(node) {
        var bind;

        if (node.type == "ident") {
            bind = binds[node.text];
            if (!bind)
                throw "Reference to undefined symbol " + node.text;
            return resolve(bind);
        } else
            return node;
    }

    function wrap(node) {
        if (node.type == "\\") {
            var body = node;

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
            head,
            tail,
            params;
       
        with (node) 
            switch (type) {
            case "defs":
                return node.map(code).join("");
            case "=":
                return "var " + code(name) + "=" + code(bind) + ";";
            case "let":
            case "letrec":
                defs.forEach(function (def) {
                    binds[def.name.text] = def.bind;
                });
                res = "function " + "(" + ")" + "{" +
                    code(defs) +
                    
                    "return " + code(expr, true) + ";" +
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
                if (params && params.length <= head.length) {
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
