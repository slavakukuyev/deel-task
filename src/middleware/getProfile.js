
const getProfile = async (req, res, next) => {
    const {Profile} = req.app.get('models')
    const profile = await Profile.findOne({where: {id: req.params.id || 0}})
    if(!profile) return res.status(401).end()
    req.profiles = profile
    next()
}

module.exports = {getProfile}