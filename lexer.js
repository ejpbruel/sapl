Lexer = new function () {
    var D       = "[0-9]",
        E       = "(?:" + "[Ee]" + "[+\\-]" + "?" + D + "+" + ")",
        L       = "[A-Z_a-z]",
        CONST   = "0[Xx]" + "[0-9A-Fa-f]" + "+" + "|"
                + "0" + "[0-7]" + "+" + "|"
                + D + "+" + E + "?" + "|"
                + D + "*" + "\\." + D + "+" + E + "?" + "|"
                + D + "+" + "\\." + D + "*" + E + "?" + "|"
                + "\"" + "(?:" + "[^\\\\\"]" + "|" + "\\\\." + ")" + "*" + "\"",
        IDENT   = L + "(?:" + L + "|" + D + ")" + "*",
        PATTERN = "letrec" + "|"
                + "let" + "|"
                + "in" + "|"
                + "select" + "|"
                + "->|\\|\\||&&|==|!=|<=|>=|<<|>>" + "|"
                + "[;=\\\\?:|^&<>+\\-*/%~!()]" + "|"
                + "(" + CONST + ")" + "|"
                + "(" + IDENT + ")",
        REGEXP  = new RegExp(PATTERN, "g");

    this.lex = function (str) {
        var tokens = [];

        str.replace(REGEXP, function (str, p1, p2) {
            tokens.push({
                type    : p1 ? "const" : p2 ? "ident" : str,
                text    : str
            });
        });
        tokens.push({});
        return tokens;
    }
}();
