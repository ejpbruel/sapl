Sapl = new function() {
    this.compile = function (str) {
        str = str.replace(/\n(?!\s)/g, ";");
        alert(str);
        alert(code = Coder.code(Parser.parse(Lexer.lex(str))));
        eval.call(null, code);
    };

    this.eval = function (expr) {
        var y, f, xs;

        if (typeof(expr) == "object") {
            if (expr.length == 1) 
                return expr[0];
            if (typeof(expr[0]) == "object") {
                y = this.eval(expr[0]);
                if (typeof(y) == "object") {
                    expr[0] = y[0];
                    if (y.length > 1)
                        expr[1] = y[1].concat(expr[1]);
                } else
                    expr[0] = y;            
            } else {
                f   = expr[0];
                xs  = expr[1];
                if (f.length <= xs.length) {
                    y = f.apply(null, xs.splice(0, f.length));
                    if (typeof(y) == "object") {
                        expr[0] = y[0];
                        if (y.length > 1)
                            expr[1] = y[1].concat(xs);
                    } else
                        expr[0] = y;            
                    if (expr[1].length == 0)
                        expr.length = 1;
                } else
                    return expr;
            }
            return this.eval(expr);
        } else 
            return expr;
    };   
}();
