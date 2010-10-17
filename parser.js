Parser = new function () {
    this.parse = function(tokens) {
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
            throw "Expected " + type + ", but got " + token.type;        
        }

        function atom() {
            var atom;

            if (atom = accept("const"))
                return atom;
            else if (atom = accept("ident"))
                return atom;
            else if (accept("(")) {
                atom = expr();
                expect(")");
                return atom;
            }
        }

        function pre() {
            var op;

            if (["+", "-", "~", "!"].some(function (type) {
                return op = accept(type);
            })) {
                op.type = "#";
                op.rhs  = pre();
                return op;
            } else
                return atom();
        }

        function app() {
            var app = pre();

            while (["letrec", "let", "\\", "~",
                    "!", "const", "ident", "("].some(function (type) {
                return token.type == type;   
            }))
                app = {
                    type    : "@",
                    fun     : app,
                    arg     : pre(),
                };
            return app;                
        }

        function select() {
            var select,
                args;

            if (select = accept("select")) {
                select.fun = pre();
                args = [];
                while (["letrec", "let", "\\", "~",
                        "!", "const", "ident", "("].some(function (type) {
                    return token.type == type;   
                }))
                    args.push(pre());
                select.args = args;
                return select;
            } else
                return app();
        }

        function infixl(types, term) {
            return function () {
                var op,
                    lhs = term();

                while (types.some(function (type) {
                    return op = accept(type);
                })) {
                    op.type = "#";
                    op.lhs  = lhs;
                    op.rhs  = term();
                    lhs = op;
                }
                return lhs;
            }
        }

        var mul     = infixl(["*", "/", "%"], select),
            add     = infixl(["+", "-"], mul),
            sh      = infixl(["<<", ">>"], add),
            rel     = infixl(["<=", "<", ">=", ">"], sh),
            eq      = infixl(["==", "!="], rel),
            and     = infixl(["&"], eq),
            xor     = infixl(["^"], and),
            or      = infixl(["|"], xor),
            land    = infixl(["&&"], or),
            lor     = infixl(["||"], land);

        function cond() {
            var pred = lor(),
                cond;

            if (cond = accept("?")) {
                cond.pred   = pred;
                cond.lhs    = expr();
                expect(":");
                cond.rhs    = expr();
                return cond;
            } else 
                return pred;
        }

        function param() {
            return {
                type : "param",
                strict : accept("!") ? true : false,
                name : accept("ident")
            };
        }

        function fun() {
            var fun,
                params;

            if (fun = accept("\\")) {
                params = [];
                while (["!", "ident"].some(function (type) {
                    return token.type == type;
                }))
                    params.push(param());
                fun.params = params;
                expect("->");
                fun.body = expr();
                return fun;
            } else
                return cond();
        }

        function expr() {
            var let;

            if (["letrec", "let"].some(function (type) {
                return let = accept(type);
            })) {
                let.defs = defs();
                expect("in");
                let.expr = expr();
                return let;
            } else
                return fun();
        }

        function def() {
            var name    = expect("ident"),
                params  = [],
                def;

            while (["!", "ident"].some(function (type) {
                return token.type == type;
            }))
            params.push(param());
            def = expect("=");
            def.name = name;
            def.bind = params.length == 0 ? expr() : {
                type    : "\\",
                params  : params,
                body    : expr()
            };
            return def;
        }

        function defs() {
            var defs = [];

            do
                defs.push(def());
            while (accept(";"));
            defs.type = "defs";
            return defs;
        }

        return defs();
    };
}();
