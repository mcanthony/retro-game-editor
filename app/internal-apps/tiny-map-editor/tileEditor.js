'use strict';

top.require(["jquery", "underscore", "model", "model/project", "view/util/query-string"],
function($, _, model, Project, queryString){

  var tinyMapEditor = (function() {
      var win = window,
          doc = document,
          pal = doc.getElementById('palette').getContext('2d'),
          map = doc.getElementById('tileEditor').getContext('2d'),
          width = 16,
          height = 12,
          tileSize = 16,
          srcTile = 0,
          sprite = new Image(),
          tiles,
          alpha,

          selectedZoom = 4,
          mapZoom = 2,
          palZoom = 2,

          tilesPerLine = 6,

          player,
          draw,
          build = doc.getElementById('build'),
          test = doc.getElementById('test'),

          placedActorNextId = 1,

          $doc = $(doc);

      var app = {
          getTile : function(e) {
              if (e.target.nodeName === 'CANVAS') {
                  var targetId = e.target.id;
                  var zoom =
                      targetId == 'tileEditor' ? mapZoom
                      : targetId == 'palette' ? palZoom
                      : 1;

                  var row = Math.floor(e.layerX / tileSize / zoom) | 0,
                      col = Math.floor(e.layerY / tileSize / zoom) | 0;

                  if (e.target.id === 'palette') srcTile = { row : row, col : col };

                  return { row : row, col : col };
              }
          },

          setTile : function(e) {
              var destTile;

              if (e.target.id === 'tileEditor' && srcTile && !draw) {
                  destTile = this.getTile(e);
                  tiles[destTile.col][destTile.row] = srcTile.col * tilesPerLine + srcTile.row;
                  map.clearRect(destTile.row * tileSize, destTile.col * tileSize, tileSize, tileSize);
                  map.drawImage(sprite, srcTile.row * tileSize, srcTile.col * tileSize, tileSize, tileSize, destTile.row * tileSize, destTile.col * tileSize, tileSize, tileSize);
              }
          },

          drawTool : function() {
              var rect = doc.createElement('canvas'),
                  ctx = rect.getContext('2d'),
                  eraser = function() {
                      ctx.fillStyle = 'red';
                      ctx.fillRect(0, 0, tileSize, tileSize);
                      ctx.fillStyle = 'white';
                      ctx.fillRect(2, 2, tileSize - 4, tileSize - 4);
                      ctx.strokeStyle = 'red';
                      ctx.lineWidth = 2;
                      ctx.moveTo(tileSize, 0);
                      ctx.lineTo(0, tileSize);
                      ctx.stroke();
                  };

              rect.width = rect.height = tileSize;
              rect.style.width = (rect.width * selectedZoom) + 'px';
              doc.getElementById('selected').appendChild(rect);
              eraser();

              this.drawTool = function() {
                  rect.width = tileSize;
                  srcTile ? ctx.drawImage(sprite, srcTile.row * tileSize, srcTile.col * tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize) : eraser();
              };
          },

          eraseTile : function(e) {
              var destTile;
              if (!draw) {
                  if (e.target.id === 'erase' && srcTile) {
                      srcTile = 0;
                  } else if (e.target.id === 'tileEditor' && !srcTile) {
                      destTile = this.getTile(e);
                      map.clearRect(destTile.row * tileSize, destTile.col * tileSize, tileSize, tileSize);
                  }
              }
          },

          drawMap : function() {
            for (var y = 0; y < height; y++) {
              for (var x = 0; x < width; x++) {
                var tileIdx = tiles[y][x],
                    srcY = Math.floor(tileIdx / tilesPerLine),
                    srcX = tileIdx % tilesPerLine;

                map.clearRect(x * tileSize, y * tileSize, tileSize, tileSize);
                map.drawImage(sprite,
                    srcX * tileSize, srcY * tileSize, tileSize, tileSize,
                    x * tileSize, y * tileSize, tileSize, tileSize);
              }
            }
          },

          clearMap : function(e) {
              if (e.target.id === 'clear') {
                  map.clearRect(0, 0, map.canvas.width, map.canvas.height);
                  this.destroy();
                  build.disabled = false;
              }
          },

          saveMap : function(e) {
              if (e.target.id === 'save') {
                this.mapEntity.save({
                  tileSetId: this.selectedTileSetId(),
                  tiles: tiles,
                  actors: this.actorsToJSON()
                });
              }
          },

          sortPartial : function(arr) {
              var len = arr.length,
                  temp = [],
                  i, j;

              for (i = 0; i < tileSize; i++) {
                  temp[i] = [];
                  for (j = 0; j < len; j++) {
                      if (j % tileSize === j) {
                          temp[i][j] = arr[j * tileSize + i];
                      }
                  }
                  temp[i] = temp[i].indexOf(255);
              }
              return temp;
          },

          actorsToJSON: function() {
            var actorElements = document.querySelectorAll('.canvasContainer > .actor');
            console.log(actorElements);

            function convertCoord(coord) {
              return Math.floor(parseInt(coord) / mapZoom);
            }

            var list = _.map(actorElements, function(el){
              return {
                x: convertCoord(el.style.left),
                y: convertCoord(el.style.top),
                actorId: el.getAttribute('data-rge-id')
              };
            });
            console.log(list);
            return list;
          },

          outputJSON : function() {
              var output = '',
                  invert = document.getElementById('invert').checked;

              if (invert) {
                  alpha.forEach(function(arr) {
                      arr.forEach(function(item, index) {
                          // using bitwise not to flip values
                          if (typeof item === 'number') arr[index] = Math.abs(~-item);
                      });
                  });
              }

              // output = (output.split('],'));
              // output = output.concat('],');

              output = JSON.stringify(alpha);
              doc.getElementsByTagName('textarea')[0].value = output;
          },

          loadMap: function() {
            var query = queryString.parse(location.search);
            var Model = model.byName(query.entity);
            this.mapEntity = Model.objects.get(query.entityId);
            this.project = Project.objects.get(this.mapEntity.get('projectId'));

            tiles = this.mapEntity.get('tiles');
            if (!tiles) {
              this.clearMapTiles();
            }

            document.getElementById('tileSets').innerHTML =
                '<option value="' + this.mapEntity.get('tileSetId') +
                '">Loading...</option>';
          },

          clearMapTiles: function() {
            tiles = [];
            for (var y = 0; y < height; y++) {
              tiles[y] = [];
              for (var x = 0; x < width; x++) {
                tiles[y][x] = 0;
              }
            }
          },

          populateTilesets: function() {
            // TODO: Rewrite this without jQuery, to match the rest of the file.

            var $select = $doc.find('#tileSets'),
                selectedValue = $select.val();

            $select.empty();
            this.project.resources.ofType('TileSet').forEach(function(tileSet){
              $select.append($('<option>')
                .attr('value', tileSet.get('id'))
                .text(tileSet.get('name') || '**unnamed**'));
            });

            $select.val(selectedValue);

            this.updateTileset();
          },

          populateActorList: function() {
            var that = this;

            var container = doc.getElementById('actorList');
            container.innerHTML = '';

            this.project.resources.ofType('Actor').forEach(function(actor){
              var li = doc.createElement('li'),
                  canvas = doc.createElement('canvas'),
                  label = doc.createElement('label');

              label.appendChild(doc.createTextNode(actor.get('name')));

              var tileSet = that.project.resources.get('TileSet', actor.get('tileSetId'));
              that.renderTileset(canvas, tileSet, {maxTiles: 1, tilesPerLine: 1});

              li.setAttribute('draggable', true);
              li.setAttribute('data-rge-id', actor.get('id'));
              li.addEventListener('dragstart', function(ev){
                ev.dataTransfer.setData("actorId", ev.target.getAttribute('data-rge-id'));
                ev.dataTransfer.setData("isFromActorList", true);
                ev.dataTransfer.setDragImage(canvas, 0, 0);
              });

              li.appendChild(canvas);
              li.appendChild(label);
              container.appendChild(li);
            });
          },

          selectedTileSetId: function() {
            var select = doc.getElementById('tileSets');
            var selectedOption = select.selectedIndex < 0 ?
                null : select.options[select.selectedIndex];

            return selectedOption && selectedOption.value;
          },

          renderTileset: function(canvas, tileSet, options) {
            if (!tileSet) {
              canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
              return;
            }

            var options = options || {},
                tiles = tileSet.tilePixels(),
                colorPalette = tileSet.palette(),
                tileCount = tiles.length;

            if (options.maxTiles) {
              tileCount = Math.min(options.maxTiles, tileCount);
            }

            canvas.width = tileSize * (options.tilesPerLine || tilesPerLine);
            canvas.height = tileSize * Math.ceil(tileCount / tilesPerLine);

            var ctx = canvas.getContext('2d'),
                imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Draw the tiles on the canvas
            var dX = 0,
                dY = 0;
            tiles.slice(0, tileCount).forEach(function(tile){
              if (tile) {
                // Draw tile on the canvas
                for (var y = 0; y < tile.length; y++) {
                  var line = tile[y],
                      yOffs = (y + dY) * canvas.width;

                  for (var x = 0; x < line.length; x++) {
                    var colorIndex = line[x],
                        rgb = colorPalette[colorIndex],
                        offs = (x + dX + yOffs) * 4;

                    imgData.data[offs] = rgb.r; // Red
                    imgData.data[offs + 1] = rgb.g; // Green
                    imgData.data[offs + 2] = rgb.b; // Blue
                    imgData.data[offs + 3] = 255; // Alpha
                  }
                }
              }

              // Calculate position of next tile
              dX += tileSize;
              if (dX >= canvas.width) {
                dX = 0;
                dY += tileSize;
              }
            });

            ctx.putImageData(imgData, 0, 0);
          },

          updateTileset: function() {
            var tileSetId = this.selectedTileSetId();
            if (tileSetId) {
              var tileSet = this.project.resources.get('TileSet', tileSetId);

              var canvas = document.createElement('canvas');
              this.renderTileset(canvas, tileSet);

              sprite.src = canvas.toDataURL();
            }
          },

          bindEvents : function() {
              var _this = this;


              /**
               * Window events
               */

              win.addEventListener('click', function(e) {
                  _this.setTile(e);
                  _this.getTile(e);
                  _this.eraseTile(e);
                  _this.drawTool();
                  _this.clearMap(e);
                  _this.saveMap(e);
              }, false);


              /**
               * Image load event
               */

              sprite.addEventListener('load', function() {
                  pal.canvas.width = this.width;
                  pal.canvas.height = this.height;
                  pal.canvas.style.width = (pal.canvas.width * palZoom) + 'px';
                  pal.drawImage(this, 0, 0);

                  _this.drawMap();
              }, false);

              /**
               * Select tileset event
               */

               document.getElementById('tileSets').addEventListener('change', function() {
                 _this.updateTileset();
               });

              /**
               * Drop actor event
               */
              map.canvas.addEventListener('dragover', function(ev){
                ev.preventDefault();
              });

              map.canvas.addEventListener('drop', function(ev){
                var actorId = ev.dataTransfer.getData("actorId"),
                    isFromActorList = ev.dataTransfer.getData("isFromActorList");

                if (!isFromActorList) {
                  console.log(ev);
                  var figure = doc.getElementById(ev.dataTransfer.getData("figureId"));
                  figure.style.left = ev.layerX + 'px';
                  figure.style.top = ev.layerY + 'px';
                  return;
                }

                var actor = _this.project.resources.get('Actor', actorId),
                    tileSet = _this.project.resources.get('TileSet', actor.get('tileSetId'));

                var figure = doc.createElement('figure'),
                    canvas = doc.createElement('canvas');

                _this.renderTileset(canvas, tileSet, {maxTiles: 1, tilesPerLine: 1});

                figure.setAttribute('id', 'placed-actor-' + (placedActorNextId++));
                figure.setAttribute('class', 'actor');
                figure.setAttribute('data-rge-id', actorId);
                figure.appendChild(canvas);

                figure.style.left = ev.layerX + 'px';
                figure.style.top = ev.layerY + 'px';

                figure.setAttribute('draggable', true);
                figure.addEventListener('dragstart', function(ev){
                  ev.dataTransfer.setData("actorId", actorId);
                  ev.dataTransfer.setData("figureId", figure.getAttribute('id'));
                });

                map.canvas.parentElement.appendChild(figure);
              });
          },

          init : function() {
              [pal, map].forEach(function(ctx){
                ctx.mozImageSmoothingEnabled = false;
                ctx.webkitImageSmoothingEnabled = false;
                ctx.msImageSmoothingEnabled = false;
                ctx.imageSmoothingEnabled = false;
              });

              this.loadMap();
              this.populateTilesets();
              this.populateActorList();

              //sprite.src = 'assets/tilemap_32a.png';
              map.canvas.width = width * tileSize;
              map.canvas.height = height * tileSize;
              map.canvas.style.width = (map.canvas.width * mapZoom) + 'px';
              this.drawTool();
          },

          destroy : function() {
              clearInterval(draw);
              alpha = [];
          }
      };



      app.bindEvents();
      app.init();
      return app;

  })();

});
