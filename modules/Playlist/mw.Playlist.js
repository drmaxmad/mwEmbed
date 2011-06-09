/**
* Playlist Embed. Enables the embedding of a playlist playlist using the mwEmbed player
*/

//Get all our message text
mw.includeAllModuleMessages();

mw.Playlist = function( options ){
	return this.init( options );
};

mw.Playlist.prototype = {

	// Stores the current clip index to be played
	clipIndex: 0,

	// Stores the cached player size:
	targetPlayerSize: null,
	
	// The source handler
	sourceHandler: null,
	
	// the theme handler:
	theme : null,
	
	// constructor
	init: function( options ) {
		var _this = this;
		
		// Check for required options: 
		if( options.src )
			this.src = options.src;
		
		if( options.srcPayLoad ){
			this.srcPayLoad = unescape(options.srcPayLoad).replace(/\+/g,' ');
		}
		
		// XXX We probably want to support empty playlist with adding clips via JS.
		if( !this.src && !this.srcPayLoad ){
			mw.log("Error no playlist source provided");
		}

		this.target = options.target;

		this.id = ( options.id )? options.id : $j( this.target ).attr( 'id' );
		if( !this.id ){
			// Give it a random id if unset:
			this.id = 'playlist_' + Math.random();
		}

		// Set the sourceHandler if provided ( should remove in favor of events )
		if( options.sourceHandler ) {
			this.sourceHandler = options.sourceHandler;
		}
		// Set the layoutHandler ( not yet active ) 
		/*if( !options.layoutHandler || option.layoutHandler == 'jqueryui'  ){
			this.layoutHandler = new mw.PlaylistThemeUi( this );
		} else if( option.layoutHandler == 'mobile' ) {
			this.layoutHandler = new mw.PlaylistThemeMobile( this );
		} else {
			mw.log("Error:: unsuported playlist theme: " + option.layoutHandler );
		}*/


		// Set binding to disable "waitForMeta" for playlist items ( we know the size and length )
		$j( mw ).bind( 'checkPlayerWaitForMetaData', function(even, playerElement ){
			if( $j( playerElement ).hasClass( 'mwPlaylist') ){
				playerElement.waitForMeta = false;
			}
		});
			
		this.type = ( options.type ) ?
			options.type:
			mw.getConfig('Playlist.DefaultType' );

		var namedOptions = ['layout', 'playerAspect', 'itemThumbWidth', 'titleHeight', 'titleLength', 'descriptionLength'];
		$j.each( namedOptions, function(inx, optionName ){
			var confName = 'Playlist.' + optionName.charAt(0).toUpperCase() + optionName.substr(1);
			_this[ optionName ] = ( options[ optionName ] )?
					options[ optionName ] :
					mw.getConfig( confName );
		});
	},
	formatTitle: function( text ){
		if( text.length > this.titleLength )
			return text.substr(0, this.titleLength-3) + '...';
		return text;
	},
	formatDescription: function( text ){
		if( text.length > this.descriptionLength )
			return text.substr(0, this.descriptionLength-3) + '...';
		return text;
	},
	drawPlaylist: function( callback ){
		var _this = this;
		// Set the target to loadingSpinner:
		$j( this.target ).empty().loadingSpinner();

		this.loadPlaylistHandler( function( sourceHandler ){
			mw.log("Playlist::drawPlaylist: sourceHandler loaded");
			_this.sourceHandler = sourceHandler;
			// Check if load failed or empty playlist
			if( _this.sourceHandler.getClipList().length == 0 ){
				$j( _this.target ).empty().text( gM('mwe-playlist-empty') );
				return ;
			}
			// Check if we should include the ui 
			if( _this.sourceHandler.hasPlaylistUi() ){
				_this.drawUI();
			} else {
				$j( _this.target )
				.empty()
				.append(
					_this.getPlayerContainer()
				);
				_this.updatePlayer( _this.clipIndex, callback );
			}
		});
	},
	getClipList:function(){
		return  this.sourceHandler.getClipList();
	},
	getPlayerContainer:function(){
		return $j( '<span />' )
		.addClass( 'media-rss-video-player-container')
		.css({
			'float' : 'left'
		})
		.append( $j('<div />').addClass('media-rss-video-player') );
	},
	/**
	* Draw the media rss playlist ui
	*/
	drawUI: function(){
		var _this = this;
		// Empty the target and setup player and playerList divs
		$j( _this.target )
		.empty()
		.addClass( 'ui-widget-content' )
		.css('position', 'relative' )
		.append(
			_this.getPlayerContainer()
			,
			$j( '<div />')
			.addClass( 'media-rss-video-list' )
			.attr('id', _this.id + '_videolist')
			.css({
				'position' : 'absolute',
				'z-index' : '1',
				'overflow-x' : 'hidden',
				'overflow-y' : 'auto',
				'bottom': '7px',
				'right' : '0px'
			})
			.hide()
		);

		// Check if we have multiple playlist and setup the list and bindings
		if( _this.sourceHandler.hasMultiplePlaylists() ){
			var playlistSet = _this.sourceHandler.getPlaylistSet();
			if( _this.layout == 'vertical' ){
				var leftPx = '0px';
			} else {
				// just the default left side assignment ( updates once we have player size ) 
				var leftPx = '444px';
			}
			var $plListContainer =$j('<div />')
			.addClass( 'playlistSet-container ui-state-default ui-widget-header ui-corner-all' )
			.css({
				'position' : 'absolute',
				'overflow' : 'hidden',
				'top' : '3px',
				'right' : '8px',
				'height' : '20px',
				'left' : leftPx
			})
			.append(
				$j('<span />')
				.addClass( 'playlistSetList' )
				.css( {
					'white-space':'pre'
				})
			);
			$j( _this.target ).append( $plListContainer );

			var $plListSet = $j( _this.target ).find( '.playlistSetList' );

			$j.each( playlistSet, function( inx, playlist){
				// check for playlist name: 
				if( !playlist.name ){
					return true;
				}
				// Add a divider
				if( inx != 0 ){
					$plListSet.append( $j('<span />').text( ' | ') );
				}
				$plListSet.append(
					$j('<a />')
					.attr('href', '#')
					.text( playlist.name )
					.click( function(){
						 _this.sourceHandler.setPlaylistIndex( inx );
						 mw.log( 'mw.Playlist:: selectPlaylist:' + inx );
						 $j( _this.target + ' .media-rss-video-list').loadingSpinner();
						 _this.sourceHandler.loadCurrentPlaylist( function(){
							 $j( _this.target + ' .media-rss-video-list').empty();
							_this.addMediaList();
						 });
						return false;
					})
					.buttonHover()
				);
			});
			
			// Check playlistSet width and add scroll left / scroll right buttons
			if( $plListSet.width() > $plListContainer.width() ){
				var baseButtonWidth = 24;
				$plListSet.css( {
					'position': 'absolute',
					'left' : baseButtonWidth + 'px'
				});
				var $scrollButton =	$j('<div />')
				.addClass( 'ui-corner-all ui-state-default' )
				.css({
					'position' : 'absolute',
					'top' : '-1px',
					'cursor' : 'pointer',
					'margin' :'0px',
					'padding' : '2px',
					'width'	: '16px',
					'height' : '16px'
				});

				var $buttonSpan = $j('<span />')
					.addClass( 'ui-icon' )
					.css('margin', '2px' );

				var plScrollPos = 0;
				var scrollToListPos = function( pos ){

					listSetLeft = $plListSet.find('a').eq( pos ).offset().left -
						$plListSet.offset().left ;

					mw.log("scroll to: " + pos + ' left: ' + listSetLeft);
					$plListSet.animate({'left': -( listSetLeft - baseButtonWidth) + 'px'} );
				};
				
				$plListContainer
				.append(
					$scrollButton.clone()
					.css('left', '0px')
					.append( $buttonSpan.clone().addClass('ui-icon-circle-arrow-w') )
					.click( function(){
						//slide right
						if( plScrollPos >= 0){
							mw.log("scroll right");
							plScrollPos--;
							scrollToListPos( plScrollPos );
						}
					})
					.buttonHover(),

					$scrollButton.clone()
					.css('right', '0px')
					.append( $buttonSpan.clone().addClass('ui-icon-circle-arrow-e') )
					.click( function(){
						//slide left
						if( plScrollPos < $plListSet.find('a').length-1 ){
							plScrollPos++;
							scrollToListPos( plScrollPos );
						}
					})
					.buttonHover()
				);
			}
		};

		// Add the selectable media list
		_this.addMediaList();

		// Add the player
		_this.updatePlayer( _this.clipIndex, function(){
			// Update the list height ( vertical layout )
			if( _this.layout == 'vertical' ){
				$j( _this.target + ' .media-rss-video-list' ).css( {
					'top' : $j( _this.target + ' .media-rss-video-player-container' ).height() + 4,
					'width' : '100%'
				} );
				// Add space for the multi-playlist selector:
				if( _this.sourceHandler.hasMultiplePlaylists() ){
					// also adjust .playlistSet-container if present
					$j( _this.target + ' .playlistSet-container').css( {
						'top' : $j( _this.target + ' .media-rss-video-player-container' ).height() + 4
					});
					$j( _this.target + ' .media-rss-video-list' ).css({
						'top' : $j( _this.target + ' .media-rss-video-player-container' ).height() + 26
					});
				}

			} else {
				// Update horizontal layout
				$j( _this.target + ' .media-rss-video-list').css( {
					'top' : '0px',
					'left' : $j( _this.target + ' .media-rss-video-player-container' ).width() + 4
				} );
				// Add space for the multi-playlist selector:
				if( _this.sourceHandler.hasMultiplePlaylists() ){
					$j( _this.target + ' .playlistSet-container').css( {
						'left' : $j( _this.target + ' .media-rss-video-player-container' ).width() + 4
					});
					$j( _this.target + ' .media-rss-video-list').css( {
						'top' : '26px'
					});
				}
			}
			var $videoList = $j( _this.target + ' .media-rss-video-list' );
			$videoList.show();
			// show the video list and apply the swipe binding
			$j( _this.target ).find('.media-rss-video-list-wrapper').fadeIn();
			if( mw.isHTML5FallForwardNative() ){
				// iScroll is buggy with current version of iPad / iPhone use scroll buttons instead
				/*
				document.addEventListener('touchmove', function(e){ e.preventDefault(); });
				var myScroll = iScroll( _this.id + '_videolist' );
				setTimeout(function () { myScroll.refresh(); }, 0);
				*/
				// Add space for scroll buttons:
				var curTop = $j( _this.target + ' .media-rss-video-list' ).css('top');
				if(!curTop) curTop = '0px';
				$j( _this.target + ' .media-rss-video-list' ).css( {
					'position' : 'absolute',
					'height' : null,
					'top' : curTop,
					'bottom' : '48px',
					'right': '8px'
				});
				if( _this.layout == 'vertical' ){
					$j( _this.target + ' .media-rss-video-list' ).css({
						'top' : $j( _this.target + ' .media-rss-video-player-container' ).height() + 8
					});
				}
				
				// Add scroll buttons if configured to do so:
				if( mw.getConfig( 'Playlist.ShowScrollButtons' ) ){
					_this.addScrollButtons( $videoList );
				}				
			}
		});
	},
	addScrollButtons: function( $videoList){
		var _this = this;
		$j( _this.target ).append(
			$j( '<div />').css({
				'position' : 'absolute',
				'bottom' : '15px',
				'right': '8px',
				'height' : '30px',
				'width' : $j( _this.target + ' .media-rss-video-list').width()
			})
			.append(
				$j.button({
					'text' : 'scroll down',
					'icon' : 'circle-arrow-s'
				})
				.css('float', 'right')
				.click(function(){
					var clipListCount = $videoList.children().length;
					var clipSize = $videoList.children(':first').height();
					var curTop = $videoList.get(0).scrollTop;

					var targetPos = curTop + (clipSize * 3);
					if( targetPos > clipListCount * clipSize ){
						targetPos = ( clipListCount * ( clipSize -1 ) );
					}
					mw.log(" animate to: " +curTop + ' + ' + (clipSize * 3) + ' = ' + targetPos );
					$videoList.animate({'scrollTop': targetPos }, 500 );

					return false;
				}),
				$j.button({
					'text' : 'scroll up',
					'icon' : 'circle-arrow-n'
				})
				.css('float', 'left')
				.click(function(){
					var clipListCount = $videoList.children().length;
					var clipSize = $videoList.children(':first').height();
					var curTop = $videoList.get(0).scrollTop;

					var targetPos = curTop - (clipSize * 3);
					if( targetPos < 0 ){
						targetPos = 0;
					}
					mw.log(" animate to: " +curTop + ' + ' + (clipSize * 3) + ' = ' + targetPos );
					$videoList.animate({'scrollTop': targetPos }, 500 );

					return false;
				})
			)
		);
	},
	/**
	* Update the target size of the player
	*/
	getTargetPlayerSize: function( ){
		var _this = this;
		if( this.targetPlayerSize ){
			return this.targetPlayerSize;
		}

		// Get the target width and height: ( should be based on layout or
		this.targetWidth = $j( this.target ).width();
		this.targetHeight = $j( this.target ).height();
		
		// if there is no player interface take all the allowed space:
		if( !_this.sourceHandler.hasPlaylistUi() ){
			return {
				'width' : this.targetWidth  + 'px',
				'height' : this.targetHeight + 'px'
			};
		}
		
		if( _this.layout == 'vertical' ){
			/* vertical layout */
			var pa = this.playerAspect.split(':');
			this.targetPlayerSize = {
				'width' : this.targetWidth + 'px',
				'height' : parseInt( ( pa[1] / pa[0] ) * this.targetWidth )
			};
		} else {
			/* horizontal layout */
			var pa = this.playerAspect.split(':');
			this.targetPlayerSize = {
				'height' : ( this.targetHeight - this.titleHeight - 10 ) + 'px',
				'width' : parseInt( ( pa[0] / pa[1] ) * this.targetHeight )
			};
		}
		if( this.targetPlayerSize.width > this.targetWidth ){
			var pa = this.playerAspect.split(':');
			this.targetPlayerSize.width = this.targetWidth;
			this.targetPlayerSize.height = parseInt( ( pa[1] / pa[0] ) * this.targetWidth );
		}
		
		return this.targetPlayerSize;
	},
	// update clip and play it ( wraps the updatePlayer function ) 
	playClip: function( clipIndex , callback ){
		var _this = this;
		this.updatePlayer( clipIndex, function(){
			// XXX not sure why timeout is needed here ... need to clean up updatePlayer callback
			setTimeout(function(){
				$j('#' +_this.getVideoPlayerId( clipIndex) ).get(0).play();
			},100);
		});
	},
	/**
	* update the player
	*/
	updatePlayer: function( clipIndex , callback ){
		var _this = this;
		var playerSize = _this.getTargetPlayerSize() ;
		this.clipIndex = clipIndex;
		// If we have a ui .. update it: 
		if( _this.sourceHandler.hasPlaylistUi() ){
			this.updatePlayerUi( clipIndex );
		}
		
		// Build the video tag object:
		var $video = $j( '<video />' )
		.attr({
			'id' : _this.getVideoPlayerId( clipIndex ),
			'poster' : _this.sourceHandler.getClipPoster( clipIndex, playerSize)
		})
		.addClass( 'mwPlaylist' )
		.css(
			playerSize
		);

		// Add custom attributes:
		_this.sourceHandler.applyCustomClipData( $video, clipIndex );

		// lookup the sources from the playlist provider:
		this.sourceHandler.getClipSources( clipIndex, function( clipSources ){
			if( clipSources ){
				for( var i =0; i < clipSources.length; i++ ){
					var $source = $j('<source />')
						.attr( clipSources[i] );
					$video.append( $source );
				}
			}
			_this.updateVideoPlayer( $video , callback);
		});
	},
	updatePlayerUi:function( clipIndex ){
		var _this = this;
		var playerSize = _this.getTargetPlayerSize() ;
		if( this.titleHeight != 0){
			// Build and output the title
			var $title = $j('<div />' )
				.addClass( 'playlist-title ui-state-default ui-widget-header ui-corner-all')
				.css( {
					'top' : '0px',
					'height' : _this.titleHeight,
					'width' : playerSize.width
				} )
				.text(
					_this.sourceHandler.getClipTitle( clipIndex )
				);
			$j( _this.target + ' .media-rss-video-player-container' ).find('.playlist-title').remove();
			$j( _this.target + ' .media-rss-video-player-container' ).prepend( $title );
		}
		// Update the player list if present:
		$j( _this.target + ' .clipItemBlock')
			.removeClass( 'ui-state-active' )
			.addClass( 'ui-state-default' )
			.eq( clipIndex )
			.addClass( 'ui-state-active' );

	},

	getVideoPlayerId: function( clipIndex ){
		if( ! clipIndex ) {
			clipIndex = this.clipIndex;
		}
		return 'mrss_' + this.id + '_' + clipIndex;
	},

	updateVideoPlayer: function( $video , callback){
		var _this = this;
		
		// If on mobile safari just swap the sources ( don't replace the video )
		// ( mobile safari can't javascript start the video )
		// see: http://developer.apple.com/iphone/search/search.php?simp=1&num=10&Search=html5+autoplay
		
		// TODO we should switch to our adTimeline player switching code
	
		if( !mw.isMobileHTML5() ){
			// Remove the old video player ( not mobile safari )
			$j( _this.target + ' .media-rss-video-player' ).empty().append( $video );
		} else {
			// Check for a current video:
			var $inDomVideo = $j( _this.target + ' .media-rss-video-player video' );
			if( $inDomVideo.length == 0 ){
				// just do a simple swap: 
				$j( _this.target + ' .media-rss-video-player' ).empty().append( $video );
			} else {
				// Update the inDomVideo object:
				// NOTE: this hits a lot of internal stuff
				// XXX Should refactor to use embedPlayer interfaces!
				var vidInterface = $j( _this.target + ' .media-rss-video-player-container' )
					.find('.mwplayer_interface div').get(0);
				// Copy over the video attributes to the the videoInterface
				$j( $video[0].attributes ).each( function(attrName, attrValue){
					vidInterface[ attrName ] = attrValue;
				});
				vidInterface.pid = 'pid_' + $video.attr('id');
				// Update the interface restore source ( xxx this is a pretty ugly hack )
				vidInterface.mediaElement.sources = [];
				$video.find('source').each(function(inx, source){
					vidInterface.mediaElement.tryAddSource( source ) ;
				});

				// Update the video interface id:
				$j( vidInterface ).attr('id', $video.attr('id'));

				if( $video.data('kuiconf') ){
					$j( vidInterface ).data( 'kuiconf', $video.data('kuiconf') );
				}

				// Update the current video target source
				$inDomVideo.attr({
					'id' : 'pid_' + $video.attr('id'),
					'src': $video.find( 'source').attr('src')
				});
				// issue the load request
				$inDomVideo.get(0).load();
			}
		}
		// Update the video tag with the embedPlayer
		$j('#' +_this.getVideoPlayerId( _this.clipIndex ) ).embedPlayer( function(){
			var embedPlayer = $j('#' +_this.getVideoPlayerId( _this.clipIndex ) ).get(0);
			if(!embedPlayer){
				mw.log("mw.Playlist::updateVideoPlayer > Error, embedPlayer not defined at embedPlayer ready time");
				return;
			}
			// Setup ondone playing binding to play next clip (if autoContinue is true )
			if( _this.sourceHandler.autoContinue == true ){
				$j( embedPlayer ).unbind('ended.playlist').bind( 'ended.playlist', function(event ){
					mw.log("Playlist:: updateVideoPlayer -> finished clip" + _this.clipIndex );
					// Play next clip
					if( _this.clipIndex + 1 < _this.sourceHandler.getClipCount() ){
						// Update the onDone action object to not run the base control done:
						embedPlayer.onDoneInterfaceFlag = false;
						_this.clipIndex++;

						// update the player and play the next clip
						_this.updatePlayer( _this.clipIndex, function(){
							_this.play();
						});

					} else {
						mw.log("Reached end of playlist run normal end action" );
						// Update the onDone action object to not run the base control done:
						embedPlayer.onDoneInterfaceFlag = true;
					}
				});
			}
			_this.addPlaylistSeekButtons( embedPlayer );
			mw.log( "player should be ready: " + _this.clipIndex + ' ' + $j('#' +_this.getVideoPlayerId() ) );
			// Run the callback if its set
			if( callback ){
				callback();
			}
		} );
	},
	// Checks if the player has next prev playlist buttons if not adds them.
	addPlaylistSeekButtons: function( embedPlayer ){
		var _this = this;
		// add previous / next buttons if not present: 
		// TODO (HACK) we should do real controlBar support for custom buttons
		if( embedPlayer.controlBuilder ){
			$controlBar = embedPlayer.$interface.find('.control-bar');
			
			if( $controlBar.find('.ui-icon-seek-next').length != 0 ){
				// already have seek buttons
				return false;
			}
			
			// make space ( reduce playhead lenght ) 
			var pleft =  parseInt( $controlBar.find('.play_head').css('left') ) + 56;
			$controlBar.find('.play_head').css('left', pleft);
			$plButton = $j('<div />')
				.addClass("ui-state-default ui-corner-all ui-icon_link lButton")
				.buttonHover()
				.append(
					$j('<span />')
					.addClass( "ui-icon")
				);
			$controlBar.find( '.play-btn').after(
				$plButton.clone().attr({
						'title' : 'Previous clip'
					})
					.click(function(){					
						if( _this.clipIndex - 1 >= 0 ){
							_this.clipIndex--;
							_this.updatePlayer( _this.clipIndex, function(){
								_this.play();
							});
							return ;
						}
						mw.log("Cant prev: cur:" + _this.clipIndex );
					})
					.find('span').addClass('ui-icon-seek-prev').parent()			
				,					
				$plButton.clone().attr({
						'title' : 'Next clip'
					})
					.click(function(){
						if( _this.clipIndex + 1 < _this.sourceHandler.getClipCount() ){
							_this.clipIndex++;
							_this.updatePlayer( _this.clipIndex, function(){
								_this.play();
							});
							return ;
						}
						mw.log("Cant next: cur:" + _this.clipIndex );
					})
					.find('span').addClass('ui-icon-seek-next').parent()
			);
		}
	},
	/**
	* Add the media list with the selected clip highlighted
	*/
	addMediaList: function() {
		var _this = this;
		$targetItemList = $j( this.target + ' .media-rss-video-list');
		// update the playlistItme total available width
		this.playlistItemWidth = $targetItemList.width();
		$j.each( this.sourceHandler.getClipList(), function( inx, clip ){
			mw.log( 'mw.Playlist::addMediaList: On clip: ' + inx);

			// Output each item with the current selected index:
			$itemBlock = $j('<div />')
				.addClass( 'ui-widget-content ui-corner-all playlistItem ui-helper-clearfix' );
				

			if( _this.clipIndex == inx ){
				$itemBlock.addClass( 'ui-state-active');
			} else {
				$itemBlock.addClass( 'ui-state-default' );
			}
			// Add a single row table with image, title then duration
			$itemBlock.append(
				_this.sourceHandler.getPlaylistItem( inx )
			)				
			.data( 'clipIndex', inx )
			.buttonHover()
			.addClass( 'clipItemBlock' 	)
			.css( {
				'cursor': 'pointer'
			} )
			.click( function(){
				mw.log( 'clicked on: ' + $j( this ).data( 'clipIndex') );
				// Make sure the existing player is "playing " (safari can't play async with javascript )
				/*if( mw.isHTML5FallForwardNative() ){
					var embedPlayer = $j('#' + _this.getVideoPlayerId() ).get(0);
					//embedPlayer.playerElement.play();
				}*/

				// Update _this.clipIndex
				_this.clipIndex = $j( this ).data( 'clipIndex' );

				_this.updatePlayer( _this.clipIndex, function(){
					_this.play();
				} );

			}); //close $itemBlock

			// Add the itemBlock to the targetItem list
			$targetItemList.append(
				$itemBlock
			);
			mw.log("added item block : " + $targetItemList.children().length );
		});
	},

	play: function(){
		var embedPlayer = $j('#' + this.getVideoPlayerId() ).get(0);
		if( mw.isMobileHTML5() ){
			embedPlayer.playerElement.play();
		} else{
			embedPlayer.play();
		}
	},

	/**
	 * Load the playlist driver from a source
	 */
	loadPlaylistHandler: function( callback ){
		var _this = this;
		if( !_this.sourceHandler ){
			switch( this.type ){
				case 'application/rss+xml':
					_this.sourceHandler = new mw.PlaylistHandlerMediaRss( this );
				break;
			}
		};
		// load the playlist
		_this.sourceHandler.loadPlaylist( function(){
			callback( _this.sourceHandler );
		});
	},

	/**
	 * Set the playlsit source handler
	 */
	setSourceHandler: function ( sourceHandler ){
		this.sourceHandler = sourceHandler;
	}
};
