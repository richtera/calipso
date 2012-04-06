/*!
 * Projects module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  Query = require("mongoose").Query,
  url = require('url'),
  fs = require('fs'),
  blocks = require(path.join(rootpath, 'lib/Blocks'));

exports = module.exports = {
  init: init,
  route: route
};

/*
 * Router
 */
function route(req, res, module, app, next) {

  // Menu items
  res.menu.admin.addMenuItem({name:'Projects',path:'prjs',url:'/projects',description:'Project management...',security:[]});
  res.menu.admin.addMenuItem({name:'Create Project',path:'prjs/newProject',url:'/projects/new',description:'Create a new project ...',security:[]});
  res.menu.admin.addMenuItem({name:'View Projects',path:'prjs/viewProjects',url:'/projects',description:'View current projects ...',security:[]});
  res.menu.primary.addMenuItem({name:'Projects',path:'prjs',url:'/projects',description:'Project management...',security:[]});
  res.menu.primary.addMenuItem({name:'Create Project',path:'prjs/newProject',url:'/projects/new',description:'Create a new project ...',security:[]});
  res.menu.primary.addMenuItem({name:'View Projects',path:'prjs/viewProjects',url:'/projects',description:'View current projects ...',security:[]});

  // Routing and Route Handler
  module.router.route(req, res, next);
}

/*
 * Initialisation
 */
function init(module, app, next) {

  calipso.e.addEvent('PROJECT_CREATE',{enabled:true,hookio:true});
  calipso.e.addEvent('FOLDER_CREATE',{enabled:true,hookio:true});
  // Projects routes
  calipso.lib.step(

  function defineRoutes() {

    // Projects dashboard
    module.router.addRoute('GET /projects', showProjects, {
      template: 'projects',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

    module.router.addRoute('GET /project/:name', showProjectByName, {
      template: 'project',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

    module.router.addRoute('GET /project/:name/:fname', showFolderByName, {
      template: 'folder',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

    module.router.addRoute('GET /projects/new', newProject, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    }, this.parallel());

    module.router.addRoute('POST /projects/new', createProject, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    },this.parallel());

    module.router.addRoute('GET /upload/:pname/:fname', newAsset, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    },this.parallel());
    module.router.addRoute('POST /upload/:pname/:fname', createAsset, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    },this.parallel());

    module.router.addRoute('GET /projects/users/:pname', showUsersForm, {
      template: 'users',
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    },this.parallel());
    module.router.addRoute('POST /projects/users/:pname', addUsers, {
      block: 'content.list',
      admin: false,
      permit: function(user){return user.username != '' ? {allow:true} : null}
    },this.parallel());

  }, function done() {
     var Project = new calipso.lib.mongoose.Schema({
        name:{type: String, required: true, "default": ''},
        description:{type: String, required: false},
        owner:{type: String, required: true, "default": 'admin'},
        permissions:{type: String, required: true, "default":'Contributor'},
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now }
      });
      var Folder = new calipso.lib.mongoose.Schema({
        name:{type: String, required: true, "default": ''},
        project:{type: String, required: true},
        canWrite: {type: Boolean, required: true, "default": true},
        canDelete: {type: Boolean, required: true, "default": false},
        created: { type: Date, "default": Date.now },
        updated: { type: Date, "default": Date.now }
      });

      calipso.lib.mongoose.model('Project', Project);
      calipso.lib.mongoose.model('Folder', Folder);

    next();

  });

}
function showProjects(req, res, template, block, next) {
  var format = req.moduleParams.format || 'html';
  res.menu.primary.addMenuItem({name:'Home',path:'back',url:'/',description:'Back to home page...',security:[]});
  res.menu.primary.addMenuItem({name:'Publisher',path:'pub',url:'/projects',description:'Publisher ...',security:[]});
  res.menu.primary.addMenuItem({name:'Staging',path:'staging',url:'/projects',description:'Staging ...',security:[]});
  calipso.lib.assets.listProjects(function(err, query) {
    query.run( function(err, projects){
      if (format === 'html') {
        calipso.theme.renderItem(req, res, template, block, {projects:projects}, next);
      } else if (format === 'json') {
        res.format = format;
        res.send(contents.map(function(u) {
          return u.toObject();
        }));
        next();
      }
    });
  });
}
function showProjectByName(req, res, template, block, next) {
  var name = req.moduleParams.name;
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";
  res.menu.primary.addMenuItem({name:'Back', path:'back',url:'/projects/', description:'Back to projects ...', security:[]});
  res.menu.primary.addMenuItem({name:'Publisher',path:'pub',url:'/projects',description:'Publisher ...',security:[]});
  res.menu.primary.addMenuItem({name:'Staging',path:'staging',url:'/projects',description:'Staging ...',security:[]});
  filterPermissions(req.session.user.username, name, 'view', function(allowed){
    if (allowed){
      res.menu.userToolbar.addMenuItem({name:'Add users',path:'new',url:'/projects/users/'+name,description:'Add users to this project ...',security:[]});
      calipso.lib.assets.findAssets([{isproject:true,title:name}]).run(function(err, project){
        if (err || project === null || !project.length) {
          res.statusCode = 404;
          next();
        } else {
          calipso.lib.assets.findAssets([{isfolder:true,folder:project[0].id}]).run(function(err, folders){
            if(err || folders === null) {
              res.statusCode = 404;
              next();
            } else {
              calipso.theme.renderItem(req, res, template, block, {
                project:project[0],
                folders:folders
              },next);
            }
          }); 
        }
      });
    } else {
      res.statusCode = 404;
      next();
    }
  });
}
function filterPermissions(user, project, action, callback) {
  calipso.lib.assets.findAssets([{isproject:true,title:project}]).run(function(err, project){
    if (err || project === null || !project.length) {
      callback(false);
    } else if (user == project[0].author) {
      callback(true);
    } else {
      var AssetPermissions = calipso.lib.mongoose.model('AssetPermissions');
      AssetPermissions.find({project:project[0].title, user:user, action:action},function(err, entry){
        if (err || entry === null || !entry.length){
          callback(false);
        } else {
          callback(true);
        }
      })
    }
  });
}
function showFolderByName(req, res, template, block, next) {
  var name = req.moduleParams.name;
  var fname = req.moduleParams.fname;
  var returnTo = req.moduleParams.returnTo ? req.moduleParams.returnTo : "";
  res.menu.primary.addMenuItem({name:'Back', path:'back',url:'/project/'+name+'/', description:'Back to project ...', security:[]});
  filterPermissions(req.session.user.username, name, 'view', function(allowed){
    if (allowed){
    res.menu.userToolbar.addMenuItem({name:'Add folder',path:'newfolder',url:'/project/'+name+'/'+fname+'/',description:'Add a subfolder ...',security:[]});
     res.menu.userToolbar.addMenuItem({name:'Add files',path:'newfiles',url:'/upload/'+name+'/'+fname+'/',description:'Upload new files ...',security:[]});
      calipso.lib.assets.findAssets([{isfolder:true,title:fname}]).run(function(err, folder){
        calipso.lib.assets.listFiles(name, fname, function(err, query){
          if(err || query === null) {
            res.statusCode = 404;
            next();
          } else {
            query.run(function(err, assets){
              calipso.theme.renderItem(req, res, template, block, {
                folder:folder[0],
                assets:assets
              },next);
            });
          }
        });
      }); 
    } else {
      res.statusCode = 404;
      next();
    }
  });
}
function newProject(req, res, template, block, next) {
  var name = req.moduleParams.name ? req.moduleParams.name : "";
  var description = req.moduleParams.description ? req.moduleParams.description : "";
  var form = {
    id:'content-type-form',
    title:'Add new project ...',
    type:'form',
    method:'POST',
    action:'/projects/new',
    tabs:false,
    fields:[
      {
        label:'Name',
        name:'name',
        type:'text',
        description:'The name of your project ...'
      },
      {
        label:'Description',
        name:'description',
        type:'textarea',
        description:'Description of your project ...'
      },
      {
        label:'',
        name:'owner',
        type:'hidden'
      },
    ],
    buttons:[
      {
        name:'submit',
        type:'submit',
        value:'Add Project'
      }
    ]
  };
  // Default values
  var values = {
    content: {
      contentType:"Project"
    },
    name:name,
    description:description,
    owner:req.session.user.username
  };

  calipso.form.render(form, values, req, function(form) {
    calipso.theme.renderItem(req,res,form,block,{},next);
  });
}
function createProject(req, res, template, block, next) {
  calipso.form.process(req, function(form) {
    if (form) {
      var returnTo = form.returnTo ? form.returnTo : "";
      createFolder('Archive', form.name, "ai-test2",form.owner, true, false, function(err, asset){
        if(err || !asset) {
          return res.send(500, err.message);
        } else {
          createFolder('Work', form.name, "ai-test3", form.owner, true, true, function(err, asset){
            if(err || !asset) {
              return res.send(500, err.message);
            } else {
              createFolder('Publish', form.name, "ai-test3", form.owner, true, true, function(err, asset){
                if(err || !asset) {
                  return res.send(500, err.message);
                } else {
                  if(returnTo) {
                    res.redirect(returnTo);
                  } else {
                    res.redirect('/project/' + form.name);
                  }
                  next();
                }
              });
            }
          }); 
        }
      });
    } else {
      req.flash('info',req.t('Woah there, slow down. You should stick with the forms ...'));
      next();
    }
  });
}
function createFolder(name, project, bucket, author, canWrite, canDelete, callback) {
  var arguments = {
    path:'s3/'+bucket+'/project:'+project+':'+name+'/',
    copySource:null,
    author:author,
    canWrite:canWrite,
    canDelete:canDelete
  };
  calipso.lib.assets.createAsset(arguments, function (err, asset) {
    callback(err, asset);
  });
}
function newAsset(req, res, template, block, next) {
  var project = req.moduleParams.pname ? req.moduleParams.pname : "";
  var folder = req.moduleParams.fname ? req.moduleParams.fname : "";
  var file = req.moduleParams.file ? req.moduleParams.file : "";
  filterPermissions(req.session.user.username, project, 'add', function(allowed){
    if (allowed) {
      var form = {
        id:'content-type-form',
        title:'Add new asset ...',
        type:'form',
        method:'POST',
        action:'/upload/'+project+'/'+folder+'/',
        tabs:false,
        fields:[
          {
            label:'File',
            name:'file',
            type:'file',
            description:'The file(s) to be uploaded ...',
            multiple:'true'
          },
          {
            name:'url',
            type:'hidden',
            value: 'proj/' + project + '/' + folder + '/'
          },
          { // If we send a filename in here then we prefer this filename to the one in the upload mime file.
            name:'name',
            type:'hidden',
            value: file
          }
        ],
        buttons:[
          {
            name:'upload',
            type:'submit',
            value:'Upload'
          }
        ]
      };
      // Default values
      var values = {
        content: {
          contentType:"Asset"
        },
        project:project,
        folder:folder,
        owner:req.session.user.username,
        file:file
      };

      calipso.form.render(form, values, req, function(form) {
        calipso.theme.renderItem(req,res,form,block,{},next);
      });
    } else {
      res.statusCode = 404;
      next();
    }
  });
}
function createAsset(req, res, template, block, next) {
  var pname = req.moduleParams.pname || '';
  var fname = req.moduleParams.fname || '';
  calipso.form.process(req, function(form) {
    if (form) {
      // req.uploadedFiles.file[0].name - Original filename
      // req.uploadedFiles.file[0].path - Path to tmp
      // req.uploadedFiles.url - Path to destination
      var Asset = calipso.lib.assets.assetModel();
      calipso.lib.assets.findAssets([{isfolder:true,alias:req.formData.url}]).findOne(function(err, folder){
        if (err) {
          res.send(500, 'problem finding root folder ' + req.formData.url);
          next();
          return;
        }
        var paths = folder.key.split('/');
        var bucket = paths.splice(0, 1)[0];
        var client = calipso.lib.assets.knox({ bucket:bucket });
        function sendFile() {
          if (req.uploadedFiles.file.length === 0) {
            res.redirect('/project/' + pname + '/' + fname + '/');
            return;
          }
          var file = req.uploadedFiles.file.splice(0, 1)[0];
          var stream = fs.createReadStream(file.path);
          // This already has a trailing '/' after the join.
          if (req.formData.name != '')
            file.name = req.formData.name;
          var s3Key = paths.join('/') + file.name;
          var fileKey = bucket + '/' + s3key;
          client.putStream(stream, escape(s3Key), function (err) {
            if (err) {
              res.statusCode = 500;
              calipso.debug('unable to write file ' + file.name);
              next();
              return;
            }
            Asset.findOne({alias:req.formData.url + file.name, key:fileKey}, function (err, asset) {
              if (asset == null) {
                asset = new Asset();
                calipso.debug('uploading new asset ' + fileKey);
              } else {
                calipso.debug('re-uploading existing asset ' + fileKey);
              }
              var stat = fs.statSync(file.path);
              asset.title = file.name;
              asset.size = stat.size;
              asset.alias = req.formData.url + file.name;
              asset.folder = folder._id;
              asset.key = fileKey;
              asset.author = ((req.session.user && req.session.user.username) || 'testing');
              asset.save(function (err) {
                if (err) {
                  res.statusCode = 500;
                  calipso.debug('unable to write file asset ' + file.name + " (file already saved to S3) " + err.message);
                  next();
                  return;
                }
                res.statusCode = 200;
                calipso.debug('file ' + file.name + ' uploaded');
                sendFile();
              });
            });
          });
        }
        sendFile();
      });
    } else {
      req.flash('info',req.t('Woah there, slow down. You should stick with the forms ...'));
      next();
    }
  });
}
function showUsersForm(req, res, template, block, next) {
  var project = req.moduleParams.pname ? req.moduleParams.pname : "";
  var user = '';
  res.menu.userToolbar.addMenuItem({name:'Done',path:'new',url:'/project/'+project,description:'Return to project view ...',security:[]});
  filterPermissions(req.session.user.username, project, 'modify', function(allowed){
    if (allowed){
      var User = calipso.lib.mongoose.model('User');
      User.find( function(err, users) {
        var usernames = [];
        users.forEach(function(user) {
          usernames.push(user.username);
        });
        var form = {
          id:'content-type-form',
          title:'Add a new user to '+project+' ...',
          type:'form',
          method:'POST',
          action:'/projects/users/'+project,
          tabs:false,
          fields:[
            {
              name:'project',
              type:'hidden',
              value:project
            },
            {
              label:'User',
              name:'user',
              type:'select',
              description:'The user to add to the project ...',
              options: function(){ return usernames;}
            },
            {
              label:'View',
              name:'view',
              type:'checkbox',
              labelFirst: true,
              description:'This user can view '+project
            },
            {
              label:'Add',
              name:'add',
              type:'checkbox',
              labelFirst: true,
              description:'This user can add to '+project
            },
            {
              label:'Modify',
              name:'modify',
              type:'checkbox',
              labelFirst: true,
              description:'This user can modify '+project
            }
          ],
          buttons:[
            {
              name:'add',
              type:'submit',
              value:'Add User'
            }
          ]
        };
        // Default values
        var values = {
          content: {
            contentType:"AssetPermissions"
          },
          project:project,
          user:user,
          view:true,
          add:false,
          modify:false
        };

        var AssetPermissions = calipso.lib.mongoose.model('AssetPermissions');
        AssetPermissions.find({project:project}, function(err, permissions){
          calipso.form.render(form, values, req, function(form) {
            calipso.theme.renderItem(req, res, form, block, {}, function(){
              calipso.theme.renderItem(req, res, template, block, {permissions:permissions}, next);
            });
          });
        });
      }); 
    } else {
      res.statusCode = 404;
      next();
    }
  });
}
function addUsers(req, res, template, block, next) {
  calipso.form.process(req, function(form) {
    if (form) {
      var AssetPermissions = calipso.lib.mongoose.model('AssetPermissions');
      function addPermission (array){
        perm = array.splice(0, 1)[0];
        if (!perm) {
          res.redirect('/projects/users/' + form.project);
          next();
        } else{
          var permission = new AssetPermissions({
            project:form.project,
            user:form.user,
            action:perm
          });
          permission.save(function (err) {
            if (err) {
              res.statusCode = 500;
              calipso.debug('unable to set permission "' + perm + '": ' + err.message);
              next();
              return;
            } else {
              addPermission(array);
            }
          });
        } 
      }
      var a = []
      if (form.view) {
        a.push('view');
      }
      if (form.add) {
        a.push('add');
      }
      if (form.modify) {
        a.push('modify');
      }
      addPermission(a);
    } else {
      req.flash('info',req.t('Woah there, slow down. You should stick with the forms ...'));
      next();
    }
  });
}