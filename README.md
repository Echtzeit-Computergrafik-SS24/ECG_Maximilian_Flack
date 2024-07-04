# ECG Maximilian Flack

## Endabgabe im Fach Echtzeitcomputergrafik SoSe 2024

<u>Ziel:</u><br/> Erstellung einer interaktiven Anwendung mithilfe des auf WebGL basierenden Frameworks <a href="https://github.com/Echtzeit-Computergrafik-SS24/Reference/tree/main/glance" target="_blank"><b>Glance</b></a>, erstellt von Clemens Sielaff.

### Protorail

Bei Protorail geht es darum, auf einem Spielfeld, das aus 6x6 Feldern besteht, von einem Startbahnhof zu einem Zielbahnhof zu gelangen. Dafür platziert man mithilfe der Pfeiltasten Gleise auf den jeweils angrenzenden Feldern.

Die Regeln:<br/>
- Alle zusätzlichen Bahnhöfe müssen einmal durchfahren werden, bevor der Zielbahnhof angesteuert wird
- Es steht nur eine begrenzte Anzahl an Treibstoff zur Verfügung. Sobald dieser leer ist, lassen sich keine weiteren Gleise platzieren
- Um weiteren Treibstoff zu erlangen, müssen die Tanktürme durchfahren werden
- Die Bäume sind Hindernisse und können nicht durchfahren werden
- Bereits platzierte Gleise lassen sich nicht entfernen und es können keine zwei Gleise auf das gleiche Feld platziert werden

Sind alle Gleise platziert, wird die Zugfahrt mit Enter gestartet. Während der Fahrt lässt sich die Kamera mithilfe der Maus um den Zug drehen. Durch Drücken von Backspace setzt sich alles auf Anfang zurück.

Link zur fertigen Anwendung: 
https://echtzeit-computergrafik-ss24.github.io/ECG_Maximilian_Flack/Prototype/