; ============================================
; Custom file type icons for KimoPlayer
; Overrides DefaultIcon for each audio format
; after Tauri registers the file associations
; ============================================

!macro NSIS_HOOK_POSTINSTALL
  ; Directly set DefaultIcon on the extension key to override ProgID icon
  ; This ensures each audio format shows its own custom icon in Explorer

  ; MP3
  WriteRegStr SHELL_CONTEXT "Software\Classes\.mp3\DefaultIcon" "" `$INSTDIR\icons\file-types\mp3\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\MP3 Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\mp3\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.mp3\DefaultIcon" "" `$INSTDIR\icons\file-types\mp3\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.mp3\DefaultIcon" "" `$INSTDIR\icons\file-types\mp3\icon.ico,0`
  ; FLAC
  WriteRegStr SHELL_CONTEXT "Software\Classes\.flac\DefaultIcon" "" `$INSTDIR\icons\file-types\flac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\FLAC Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\flac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.flac\DefaultIcon" "" `$INSTDIR\icons\file-types\flac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.flac\DefaultIcon" "" `$INSTDIR\icons\file-types\flac\icon.ico,0`
  ; WAV
  WriteRegStr SHELL_CONTEXT "Software\Classes\.wav\DefaultIcon" "" `$INSTDIR\icons\file-types\wav\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\WAV Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\wav\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.wav\DefaultIcon" "" `$INSTDIR\icons\file-types\wav\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.wav\DefaultIcon" "" `$INSTDIR\icons\file-types\wav\icon.ico,0`
  ; OGG
  WriteRegStr SHELL_CONTEXT "Software\Classes\.ogg\DefaultIcon" "" `$INSTDIR\icons\file-types\ogg\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\OGG Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\ogg\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.ogg\DefaultIcon" "" `$INSTDIR\icons\file-types\ogg\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.ogg\DefaultIcon" "" `$INSTDIR\icons\file-types\ogg\icon.ico,0`
  ; M4A
  WriteRegStr SHELL_CONTEXT "Software\Classes\.m4a\DefaultIcon" "" `$INSTDIR\icons\file-types\m4a\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\M4A Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\m4a\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.m4a\DefaultIcon" "" `$INSTDIR\icons\file-types\m4a\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.m4a\DefaultIcon" "" `$INSTDIR\icons\file-types\m4a\icon.ico,0`
  ; AAC
  WriteRegStr SHELL_CONTEXT "Software\Classes\.aac\DefaultIcon" "" `$INSTDIR\icons\file-types\aac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\AAC Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\aac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.aac\DefaultIcon" "" `$INSTDIR\icons\file-types\aac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.aac\DefaultIcon" "" `$INSTDIR\icons\file-types\aac\icon.ico,0`
  ; WMA
  WriteRegStr SHELL_CONTEXT "Software\Classes\.wma\DefaultIcon" "" `$INSTDIR\icons\file-types\wma\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\WMA Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\wma\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.wma\DefaultIcon" "" `$INSTDIR\icons\file-types\wma\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.wma\DefaultIcon" "" `$INSTDIR\icons\file-types\wma\icon.ico,0`
  ; OPUS
  WriteRegStr SHELL_CONTEXT "Software\Classes\.opus\DefaultIcon" "" `$INSTDIR\icons\file-types\opus\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\Opus Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\opus\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.opus\DefaultIcon" "" `$INSTDIR\icons\file-types\opus\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.opus\DefaultIcon" "" `$INSTDIR\icons\file-types\opus\icon.ico,0`
  ; APE
  WriteRegStr SHELL_CONTEXT "Software\Classes\.ape\DefaultIcon" "" `$INSTDIR\icons\file-types\ape\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\APE Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\ape\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.ape\DefaultIcon" "" `$INSTDIR\icons\file-types\ape\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.ape\DefaultIcon" "" `$INSTDIR\icons\file-types\ape\icon.ico,0`
  ; AIFF
  WriteRegStr SHELL_CONTEXT "Software\Classes\.aiff\DefaultIcon" "" `$INSTDIR\icons\file-types\aiff\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\AIFF Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\aiff\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.aiff\DefaultIcon" "" `$INSTDIR\icons\file-types\aiff\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.aiff\DefaultIcon" "" `$INSTDIR\icons\file-types\aiff\icon.ico,0`
  ; ALAC
  WriteRegStr SHELL_CONTEXT "Software\Classes\.alac\DefaultIcon" "" `$INSTDIR\icons\file-types\alac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\ALAC Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\alac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.alac\DefaultIcon" "" `$INSTDIR\icons\file-types\alac\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.alac\DefaultIcon" "" `$INSTDIR\icons\file-types\alac\icon.ico,0`
  ; AMR
  WriteRegStr SHELL_CONTEXT "Software\Classes\.amr\DefaultIcon" "" `$INSTDIR\icons\file-types\amr\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\AMR Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\amr\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.amr\DefaultIcon" "" `$INSTDIR\icons\file-types\amr\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.amr\DefaultIcon" "" `$INSTDIR\icons\file-types\amr\icon.ico,0`
  ; DTS
  WriteRegStr SHELL_CONTEXT "Software\Classes\.dts\DefaultIcon" "" `$INSTDIR\icons\file-types\dts\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\DTS Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\dts\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.dts\DefaultIcon" "" `$INSTDIR\icons\file-types\dts\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.dts\DefaultIcon" "" `$INSTDIR\icons\file-types\dts\icon.ico,0`
  ; DD / AC3 (Dolby Digital)
  WriteRegStr SHELL_CONTEXT "Software\Classes\.dd\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\Dolby Digital Audio\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.dd\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.dd\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\.ac3\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\KimoPlayer.ac3\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`
  WriteRegStr SHELL_CONTEXT "Software\Classes\com.kimo.player.ac3\DefaultIcon" "" `$INSTDIR\icons\file-types\dd\icon.ico,0`

  ; Notify shell to refresh icons immediately
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
