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

        var mul     = infixl(["*", "/", "%"], app),
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

        function params() {
            var params = [];

            while (!accept("->"))
                params.push(param());
            return params;
        }

        function fun() {
            var fun;

            if (fun = accept("\\")) {
                fun.params = params();
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
                def     = expect("=");

            def.name    = name;
            def.bind    = expr();
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
