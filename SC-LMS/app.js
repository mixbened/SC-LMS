require('dotenv').config()
// import express npm package
var express = require('express')
var Sequelize = require('sequelize')
var bodyParser = require('body-parser')
var models = require('./models')
var passwordHash = require('password-hash')
var session = require('express-session')
var markdown = require( "markdown" ).markdown

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

// initialize express
var app = express()

// MIDDLEWARE
// use json parser
app.use(bodyParser.urlencoded({ extended: true })); 

// Ejs Setup
app.set('view-engine', 'ejs')

// use sessions for auth
app.use(session({
    secret: process.env.SECRET,
    saveUninitialized: false,
    resave: false,
}));

// serve stylesheets, media and js
app.use(express.static('public'))


// PAGES
app.get('/', verifySession, function(req, res){
	res.render('home.ejs',{logged: true})
})

app.get('/login', (req, res) => {
    res.render('login.ejs', {logged: false});
  });

app.get('/trainer', verifySession, verifyTrainer, (req, res) => {
    res.render('trainer.ejs', {logged: true});
});

app.get('/create-lesson', verifyTrainer, (req, res) => {
    res.render('create_lesson.ejs', {logged: true});
});

app.get('/create-course', verifyTrainer, (req, res) => {
	models.Lesson.findAll({attributes: ['id','title']}).then(response => {
		var lessons = response.map(lesson => {
			return lesson.dataValues;
		})
    	res.render('create_course.ejs', {logged: true, lessons: lessons});
	}).catch(err => console.log('Error ', err))
});

app.get('/courses', verifyTrainer, (req, res) => {
	models.Course.findAll({attributes: ['id', 'title']}).then(response => {
		var courses = response.map(course => {
			return course.dataValues
		})
		res.render('courses.ejs', {logged: true, courses: courses});
	}).catch(err => console.log('error ', err))
});

app.get('/register', (req, res) => {
    res.render('register.ejs', {logged: false});
  });

app.get('/lesson/:id', verifySession, (req, res) => {
	models.Lesson.findOne({where: {id: req.params.id}}).then(response => {
		var lesson = response.dataValues
		var title = lesson.title
		var content = markdown.toHTML(lesson.content)
		res.render('lesson.ejs', {logged: true, title: title, content: content})
	}).catch(err => console.log('error ', err))
  });

app.get('/course/:id', verifySession, (req, res) => {
	// console.log('Searching for Course ', req.params.id)
	models.Course.findOne({attributes: ['id', 'title'], where: {id: req.params.id}}).then(response => {
		var course = response.dataValues
		var title = course.title
		var id = course.id
		models.Course_Lesson.findAll({attributes: ['lesson_id','course_id', 'lesson_title'], where: {course_id: id}}).then(response => {
			var lessons = response.map(lesson => {
				return lesson.dataValues;
			})
			res.render('course.ejs', {logged: true, title: title, lessons: lessons})
		}).catch(err => console.log('Error ', err))
	}).catch(err => console.log('error ', err))
  });

app.get('/course/edit/:id', verifySession, verifyTrainer, (req, res) => {
	models.Course.findOne({attributes: ['id', 'title'], where: {id: req.params.id}}).then(response => {
		var course = response.dataValues
		var title = course.title
		var course_id = course.id
		models.Lesson.findAll({attributes: ['id', 'title']}).then(l_response => {
			var all_lessons = l_response.map(lesson => {
				return lesson.dataValues;
			})
			models.Course_Lesson.findAll({attributes: ['course_id','lesson_id', 'lesson_title'], where: {course_id: course_id}}).then(response => {
				var matchs = response.map(match => {
					return match.dataValues;
				})
				console.log('Before ', all_lessons)
				matchs.forEach(function(match) {
					var id = match.lesson_id
					var index = all_lessons.findIndex(el => el.id === id)
					all_lessons[index].match = true
				})
				console.log('After ', all_lessons)
				res.render('edit_course.ejs', {logged: true, lessons: all_lessons, title: title, id: course_id});
			}).catch(err => console.log('Error ', err))	
		}).catch(err => console.log('error ', err))
	}).catch(err => console.log('error ', err))
  });


// ENDPOINTS
app.post('/register', function(req, res){
	var username = req.body.username
	var password = req.body.password
	var trainer = false
    var hashedPassword = passwordHash.generate(password);
	console.log('Register', username, hashedPassword)
	models.User.create({username: username, password: hashedPassword, trainer: trainer}).then(result => {
		console.log('response', res)
		res.redirect('/login')
	}).catch(err => console.log('Error', err))
})

// login functionality
app.post('/login', function(req, res){
	models.User.findOne({where: {username: req.body.username}}).then(user => {
		if(!user) res.redirect('/login')
		var user = user.dataValues
		var username = user.username
		var hashedPassword = user.password
		var trainer = user.trainer
		if(passwordHash.verify(req.body.password, hashedPassword)){
			req.session.user = username
			req.session.trainer = trainer
			res.redirect('/')
		} else {
			res.redirect('/login')
		}
	}).catch(err => console.log('Error: ', err))
})

app.post('/create-lesson',verifyTrainer, function(req, res){
	var title = req.body.title
	var content = req.body.content
	models.Lesson.create({title: title, content: content}).then(response => {
		res.render('trainer.ejs', {logged: true})
	}).catch(err => console.log('error ', err))
})

app.post('/create-course',verifyTrainer, function(req, res){
	//console.log('Request ',req.body.title)
	var title = req.body.title
	var selected = req.body.selected
	// console.log('New Course:', title, selected)
	models.Course.create({title: title}).then(response => {
		var course_id = response.dataValues.id
		var records = []
		selected.forEach(lesson => {
			var record = {lesson_id: lesson.id,course_id: course_id, lesson_title: lesson.title}
			records.push(record)
		})
		models.Course_Lesson.bulkCreate(records).then(db_response => {
			// console.log('response', db_response)
			res.render('trainer.ejs', {logged: true})
		}).catch(err => console.log('error ', err))
	}).catch(err => console.log('error ', err))
})

app.post('/edit-course/:id',verifyTrainer, function(req, res){
	var id = req.params.id
	var title = req.body.title
	var selected = req.body.selected
	console.log('edit kurs', title, id, selected)
	res.render('trainer.ejs', {logged: true})
})

app.get('/logout', function(req, res) {
	req.session.destroy()
	res.redirect('/login')
})


// start web server
app.listen(process.env.PORT, function(){
	console.log('Web Server started', process.env.PORT)
})