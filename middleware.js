function verifySession(req, res, next){
	if(req.session.user){
		// console.log('Session Verify: ', req.session)
		return next()
	} else {
		res.redirect('/login')
	}
}
function verifyTrainer(req, res, next){
	if(req.session.trainer){
		// console.log('Trainer Verify: ', req.session.trainer)
		return next()
	} else {
		res.redirect('/')
	}
}
function verifyAdmin(req, res, next){
	admins = ['ben', 'christine.schluetz@startplatz.de']
	check = admins.indexOf(req.session.user) >= 0
	if(check){
		// console.log('Trainer Verify: ', req.session.trainer)
		return next()
	} else {
		res.redirect('/')
	}
}

// export for app.js
exports.verifySession = verifySession
exports.verifyTrainer = verifyTrainer
exports.verifyAdmin = verifyAdmin