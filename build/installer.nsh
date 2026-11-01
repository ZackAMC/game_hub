; Al desinstalar: borrar la entrada de "Iniciar con Windows", para no dejar una entrada
; apuntando a un .exe que ya no existe. Mismo nombre que RUN_VALUE_NAME en src/main/autostart.ts.
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "GameHub"
!macroend
