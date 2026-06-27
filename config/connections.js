const { MongoClient } = require('mongodb')

const state = {
    db: null
}

module.exports.connect = async function () {

    const url = 'mongodb://127.0.0.1:27017'
    const dbname = 'Doubthub'

    const client = await MongoClient.connect(url)

    state.db = client.db(dbname)
}

module.exports.get = function () {
    return state.db
}