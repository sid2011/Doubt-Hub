const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");

dayjs.extend(relativeTime);

function timeAgo(date) {
    return dayjs(date).fromNow();
}

module.exports = timeAgo;