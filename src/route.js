var route = (function() {
    var get_hash = function() {
        return window.location.hash.slice(1).split('?')[0];
    };

    return {
        'get_hash':get_hash
    };
})();

if (typeof module !== 'undefined') {
    module.exports.route = route;
}
