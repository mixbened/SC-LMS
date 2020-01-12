require('dotenv').config()
// import express npm package
var express = require('express')
var Sequelize = require('sequelize')
var bodyParser = require('body-parser')
var models = require('./models')
var passwordHash = require('password-hash')
var session = require('express-session')
var markdown = require( "markdown" ).markdown
var verifySession = require( "./middleware" ).verifySession
var verifyTrainer = require( "./middleware" ).verifyTrainer


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
	username = req.session.user
	user_id = req.session.user_id
	models.Course_User.findAll({attributes: ['course_id', 'user_id', 'course_title'], where: {user_id: user_id}}).then(response => {
		var courses = response.map(course => course.dataValues)
		res.render('home.ejs',{logged: true, username: username, courses: courses})
	}).catch(err => console.log('error ', err))
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

app.get('/course/students/:title/:id',verifySession, verifyTrainer, function(req,res){
	var course_title = req.params.title
	var course_id = req.params.id
	models.sequelize.query("SELECT * FROM course_users INNER JOIN users ON course_users.user_id = users.id WHERE course_users.course_title = ?", {replacements: [course_title]}).then(response => {
		var data = response[0]
		//console.log(data)
		res.render('course_user.ejs', {logged: true, data: data, course_title: course_title, course_id: course_id})
	}).catch(err => console.log("Error in retrieving Users: ", err))
})


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

app.get('/all-students/:title', function(req, res) {
	var title = req.params.title
	models.sequelize.query("SELECT * FROM users").then(response => {
		var data = response[0]
		//console.log('Kurs ', title, data)
		res.json(data)
	}).catch(err => console.log('error in retrieving users', err))
})

// login functionality
app.post('/login', function(req, res){
	models.User.findOne({where: {username: req.body.username}}).then(user => {
		if(!user) res.redirect('/login')
		var user = user.dataValues
		var username = user.username
		var user_id = user.id
		var hashedPassword = user.password
		var trainer = user.trainer
		if(passwordHash.verify(req.body.password, hashedPassword)){
			req.session.user = username
			req.session.user_id = user_id
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

// this receives a new set equivalent to create course
// first delete course and lesson course entry and then create course completely
app.post('/edit-course/:id',verifyTrainer, function(req, res){
	var course_id = req.params.id
	//console.log('Change course ' + course_id, req.body)
	var title = req.body.title
	var selected = req.body.selected
	models.Course.destroy({where: {id: course_id}}).then(del_res => {
		models.Course_Lesson.destroy({where: {course_id: course_id}}).then(response => {
			// delete complete - now create
			models.Course.create({title: title}).then(response => {
				var course_id = response.dataValues.id
				var records = []
				selected.forEach(lesson => {
					var record = {lesson_id: lesson.id,course_id: course_id, lesson_title: lesson.title}
					records.push(record)
				})
				models.Course_Lesson.bulkCreate(records).then(db_response => {
					res.render('trainer.ejs', {logged: true})
				}).catch(err => console.log('error ', err))
			}).catch(err => console.log('error ', err))
		}).catch(err => console.log('error ', err))
	}).catch(err => console.log('error ', err))
})

app.get('/logout', function(req, res) {
	req.session.destroy()
	res.redirect('/login')
})

app.post('/add-students',verifySession, verifyTrainer, function(req, res) {
	//console.log('Change students ', req.body)
	models.Course_User.bulkCreate(req.body.selected).then(d_response => {
		console.log('Create User ', d_response)
		res.status(200).json({result: 'success'})
	}).catch(err => console.log('Error in adding students to course ', err))
})

app.get('/remove/:course_id/:user_id', function(req, res) {
	var { course_id, user_id } = req.params
	models.Course_User.destroy({where: {course_id: course_id, user_id: user_id}}).then(d_response => {
		res.status(200).json({result: 'success'})
	}).catch(err => console.log('Error in removing student ', err))
})

// start web server
app.listen(process.env.PORT, function(){
	console.log('Web Server started', process.env.PORT)
})