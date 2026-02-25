GNSS system for operating vehicles—
General specifications for the communication protocol and data
format of BD compatible vehicle terminal
Report is issued by the Ministry of transport of the People’s Republic of China.
January 2013
2
Preface...............................................................................................................................................60
The terminal communicationprotocol anddata format of theroadtransport vehiclesatellite
positioningsystem..............................................................................................................................7
1.Scope...............................................................................................................................................7
2.Normativedocumentsreference....................................................................................................7
3.Terms,definitionsandabbreviations..............................................................................................7
3.1Termsanddefinitions............................................................................................................7
3.1.1.....................................................................................................................................7
3.1.2.....................................................................................................................................7
3.1.3.....................................................................................................................................7
3.1.4.....................................................................................................................................7
3.1.5.....................................................................................................................................8
3.1.6.....................................................................................................................................8
3.1.7.....................................................................................................................................8
3.1.8.....................................................................................................................................8
3.1.9.....................................................................................................................................8
3.1.10...................................................................................................................................8
3.2Abbreviations........................................................................................................................8
4.Protocolbasis..................................................................................................................................8
4.1Communicationway.............................................................................................................8
4.2Datatype...............................................................................................................................9
4.3Transmissionrules.................................................................................................................9
4.4Constitutionofmessages......................................................................................................9
4.4.1Messagestructure.....................................................................................................9
4.4.2Flagbit........................................................................................................................9
4.4.3Header........................................................................................................................9
4.4.4Checkcode...............................................................................................................10
5.Communicationconnection..........................................................................................................10
5.1Connectionstartup.............................................................................................................10
5.2Maintenanceofconnection................................................................................................11
5.3Connectiondisconnected...................................................................................................11
6.Messageprocessing......................................................................................................................11
6.1TCPandUDPmessageprocessing......................................................................................11
6.1.1Messagesmainlysendfromtheplatform...............................................................11
6.1.2Messagesmainlysendfromtheterminal...............................................................11
6.2SMSmessagedispose.........................................................................................................12
7.Protocolclassification...................................................................................................................12
7.1Introduction........................................................................................................................12
7.2Terminalmanagementprotocol.........................................................................................12
7.2.1Terminalregistration/logout...................................................................................12
7.2.2Terminalauthentication...........................................................................................12
7.2.3Set/queryterminalparameters...............................................................................12
7.2.4Terminalcontrol.......................................................................................................12
7.3Locationandalarmprotocol...............................................................................................13
3
7.3.1Locationinformationreport....................................................................................13
7.3.2Locationinformationquery.....................................................................................13
7.3.3Temporarylocationtrackingcontrol.......................................................................13
7.3.4Terminalalarm.........................................................................................................13
7.4Informationprotocol...........................................................................................................13
7.4.1Textinformationsending.........................................................................................13
7.4.2Eventsettingandreporting.....................................................................................13
7.4.3Questions.................................................................................................................13
7.4.4Informationon-demand..........................................................................................13
7.5Telephoneprotocol.............................................................................................................14
7.5.1Callback...................................................................................................................14
7.5.2Settelephonedirectory...........................................................................................14
7.6Vehiclecontrolprotocol......................................................................................................14
7.7Vehiclemanagementprotocol............................................................................................14
7.8Informationcollectionprotocol..........................................................................................14
7.8.1Collectdriver’sidentityinformationdata...............................................................14
7.8.2Collectelectronicwaybilldata.................................................................................15
7.8.3Collectdrivingrecorddata.......................................................................................15
7.8.4Requestdrivingrecordparameter...........................................................................15
7.9Multimediaprotocol...........................................................................................................15
7.9.1Multimediaeventinformationuploading...............................................................15
7.9.2Multimediadataupload..........................................................................................15
7.9.3Camerashotimmediately........................................................................................15
7.9.4Startrecording.........................................................................................................15
7.9.5Retrieveterminalstoringandextractingmultimediadata.....................................15
7.10Generaldatatransfer........................................................................................................16
7.11Encryptionprotocol..........................................................................................................16
7.12Sub-packagemessage.......................................................................................................16
8.Dataformat...................................................................................................................................16
8.1Terminalgeneralresponse..................................................................................................16
8.2Platformgeneralresponse..................................................................................................16
8.3Terminalheartbeat..............................................................................................................17
8.4Resendsub-packagerequest..............................................................................................17
8.5Terminalregistration...........................................................................................................17
8.6Terminalregistrationresponse...........................................................................................18
8.7Terminal logout...................................................................................................................18
8.8Terminalauthentication......................................................................................................18
8.9Terminalparametersetting................................................................................................19
8.10Checkterminalparameter................................................................................................25
8.11Checkspecifiedterminalparameters...............................................................................25
8.12Checkterminalparameterresponse................................................................................25
8.13Terminalcontrol................................................................................................................25
8.14Checkterminalattribute...................................................................................................27
8.15Checkterminalattributeresponse...................................................................................27
4
8.16Senddownterminalupdatepacket..................................................................................28
8.17Notificationofterminalupgradesresults.........................................................................29
8.18Locationinformationreport.............................................................................................29
8.19Locationinformationquery..............................................................................................34
8.20Locationinformationqueryresponse..............................................................................34
8.21Temporarylocationtrackingcontrol.................................................................................34
8.22Manuallyconfirmalarmmessage....................................................................................34
8.23Senddowntextinformation.............................................................................................35
8.24Eventsetting......................................................................................................................35
8.25Eventreport......................................................................................................................36
8.26Questionsendsdown.......................................................................................................36
8.27Questionresponse............................................................................................................37
8.28Informationon-demandmenusetting.............................................................................37
8.29Informationon-demand/cancels......................................................................................38
8.30Informationservice...........................................................................................................38
8.31Callback............................................................................................................................38
8.32Phonebooksetting...........................................................................................................38
8.33Vehiclecontrol..................................................................................................................39
8.34Vehiclecontrolresponse...................................................................................................39
8.35Settingcirclearea..............................................................................................................39
8.36Deletecirclearea..............................................................................................................41
8.37Settingrectanglearea.......................................................................................................41
8.38Deleterectanglearea........................................................................................................42
8.39Settingpolygonarea.........................................................................................................42
8.40Deletepolygonarea..........................................................................................................43
8.41Settingroute......................................................................................................................43
8.42Deleteroute......................................................................................................................44
8.43Drivingrecorddatacollectcommand...............................................................................45
8.44Drivingrecorddataupload...............................................................................................45
8.45Drivingrecordparametersenddowncommand.............................................................45
8.46Electronicwaybillreport...................................................................................................45
8.47Reportdriver’sidentityinformationrequest...................................................................46
8.48Driver’sidentityinformationcollectsreport....................................................................46
8.49Positioningdatabatchupload..........................................................................................47
8.50CANbusdatauploading....................................................................................................47
8.51Multimediaeventinformationuploading........................................................................48
8.52Multimediadataupload...................................................................................................48
8.53Multimediadatauploadresponse....................................................................................49
8.54Cameraimmediatelytakencommand..............................................................................49
8.55Cameraimmediatelytakencommandresponse..............................................................49
8.56Retrieveofstoremultimediadata....................................................................................50
8.57Responseofstoremultimediadataretrieves..................................................................50
8.58Storemultimediadatauploadcommand.........................................................................51
8.59Soundrecordstartcommand...........................................................................................51
5
8.60Singlestoragemultimediadataretrievaluploadscommand..........................................51
8.61Datadownlinkpass-through.............................................................................................52
8.62Datauplinkpass-through..................................................................................................52
8.63Datacompressionreport..................................................................................................52
8.64TheRSApublickeyofplatform.........................................................................................53
8.65TheRSApublickeyofterminal.........................................................................................53
AppendixA........................................................................................................................................54
A.1Device..................................................................................................................................54
A.1.1Host..........................................................................................................................54
A.1.2Slavemachine..........................................................................................................54
A.2Communicationprotocol....................................................................................................54
A.2.1Definitionofframeformat......................................................................................54
A.2.2Appendrulesofperipheralsprotocol.....................................................................55
A.3Definitionofgeneralprotocol............................................................................................56
A.3.1Slavemachinepoweronindication........................................................................56
A.3.2Peripheralslinkpolling............................................................................................56
A.3.3Slavemachinepowercontrol..................................................................................56
A.3.4Checkversionnumberinformationofslavemachine............................................56
A.3.5Slavemachineself-check.........................................................................................57
A.3.6Slavemachinefirmwareupdate..............................................................................57
A.3.7Checkperipheralattribute......................................................................................57
A.4Definitionofproprietaryprotocol......................................................................................58
A.4.1RoadtransportcertificateICcardauthenticationrequest.....................................58
A.4.2RoadtransportcertificateICcardreadingresultnotification................................59
A.4.3Cardpullsoutnotification.......................................................................................60
A.4.4ActivetriggerreadingICcard..................................................................................60
AppendixB........................................................................................................................................61
Preface
This specification is a complement and improvement of JT/T 808-2011 ‘Terminal communication
protocol and data format of road transport vehicle satellite positioning system’. Compared with
JT/T 808-2011, the main changes are as follows:--The description of 5.2 ‘connection maintenance’ in the communication connection is modified;--The process description of 7.8.1 ‘collect the identity information data of driver’ in the protocol
classification is modified;--The process description of 7.12 ‘sub-package messages’ in the protocol classification is added;--The content of the original chapter 8.4 ‘terminal registration’, 8.8 ‘terminal parameters setting’,
8.12 ‘location information reporting’, 8.23 ‘text information sending’, 8.28 ‘circle area setting’,
8.36 ‘driving record data acquisition command’, 8.37 ‘driving record data upload’, 8.38 ‘driving
record parameters request command’, 8.40 ‘identity information of driver reported’, 8.41
‘multimedia event information upload’, 8.42 ‘multimedia data upload’, 8.43 ‘multimedia data
upload response’, 8.46 ‘storage multimedia data retrieval response’, 8.49 ‘data downlink
pass-through’ and 8.50 ‘data uplink pass-through’, etc in the data format is modified.--Added 12 commands in the data format of 8.4 ‘sub-package requests’, 8.11 ‘query the specified
terminal parameter’, 8.14 ‘query terminal attribute’, 8.15 ‘query terminal attribute response’,
8.16 ‘terminal upgrade package sending’, 8.17 ‘notification of terminal upgrade result’, 8.22
‘manually confirm alarm message’, 8.47 ‘report the driver’s identity information request’, 8.49
‘location data batch upload’, 8.50 ‘CAN bus data upload’, 8.55 ‘camera immediately taken
command response’, 8.60 ‘single storage multimedia data retrieval and upload order, etc. The
influenced chapter and table numbers are also adjusted.--The contents of table A.2 ‘peripheral type number table’, A.3 ‘command type table’ in appendix
Aare modified.--Added terminal host and peripheral communication protocol instructions of A.3.4 ‘query slave
version number information’, A.3.5 ‘slave self-check’, A.3.6 ‘slave firmware update’, A.3.7 ‘query
peripheral attribute’, A.4.1 ‘road transport certification IC card certificate request’, A.4.2 ‘road
transport certification IC card reading result notification’, A.4.3 ‘card drawing notification’, A.4.4
‘active trigger reading IC card’, etc in appendix A.--The above changes correspond to the above changes in the table of information contrast in
appendix B is modified.
This specification is submitted by the ministry of transport of the People’s Republic of China. The
drafting unit of this specification: China traffic communication information center.
6
Theterminal communication protocoland data format
of the road transport vehicle satellite positioning system
1. Scope
The specification provides communication protocol and data format between the road transport
vehicle satellite positioning system beidou compatible vehicle terminal (hereinafter referred to as
the terminal) and the supervising/monitoring platform (hereinafter referred to as the platform).
Including protocol base, communication connection, message processing, protocol classification,
illustration and data format.
This specification is applicable to the communication between the road transport vehicle satellite
positioning system beidou compatible vehicle terminal and platform.
2. Normative documents reference
The following documents are essential for the application of this document. Reference file that
has a date, only the date that is indicated is applicable to this document. The latest version
(including all of the modifications) of the undated reference file is applicable to this document.
GB/T 2260 Code of administrative division of the People’s Republic of China
GB/T 19056 Vehicle tachograph
JT/T 415-2006 Road transport e-government platform cataloging encoding rules
JT/T 794 Vehicle terminal technical requirements for road transport vehicle satellite positioning
system
3. Terms, definitions and abbreviations
3.1 Termsanddefinitions
The following terms and definitions are applied to this document.
3.1.1
Abnormal data communication link
The wireless communication link is disconnected, or temporarily suspended (such as during the
call process).
3.1.2
Register
The terminal sends message to the platform informing that it is installed on a certain vehicle.
3.1.3
Logout
The terminal sends message to the platform informing to remove it from the installed vehicle.
3.1.4
Authentication
Whenterminal connects to the platform, it sends a message to the platform to verify its identity.
7
3.1.5
Location reporting strategy
Timing/distance interval reporting or both.
3.1.6
Location reporting program
The rules of periodic reporting interval are determined according to relevant conditions.
3.1.7
Additional points report while turning
The terminal reports the location information when it is judged that the vehicle is changing
direction. Sampling frequency is not less than 1Hz, car azimuth rate not less than 15°/s, and
continues for at least more than 3s.
3.1.8
Answering strategy
The rules of answering incoming calls automatically or manually.
3.1.9
SMStext alarm
Whenterminal alarm, send text message by SMS.
3.1.10
Event item
Event items are preset by the platform to the terminal, which consists of event encoding and
event names. The driver operates the terminal when encounters the corresponding event, and
the trigger event report is sent to the platform.
3.2 Abbreviations
The following abbreviations are applied to this document.
APN-- access point name
GZIP-- GNU zip
LCD-- liquid crystal display
RSA-- An asymmetric cryptographic algorithm (developed by Ron Rivest, Adi Shamirh and Len
Adleman, RSA named from the first letter of the three people’s name).
SMS-- short message service
TCP-- transmission control protocol
TTS-- text to speech
UDP-- user datagram protocol
VSS-- vehicle speed sensor
4. Protocol basis
4.1 Communicationway
The communication way of this protocol should comply with the relevant provisions of JT/T 794.
Communication protocol is either TCP or UDP, the platform serves as the server and the terminal
as the client. When the data communication link is abnormal, the terminal can communicate by
SMSmessage.
8
4.2 Data type
The data types used in the protocol message are shown in table 1:
Table 1: data type
Data type
Descriptions and requirements
BYTE
Nosymbol single byte integer (bytes, 8 bits)
WORD
Nosymbol double byte integer (word, 16 bits)
DWORD
Nosymbol four-byte integer (double word, 32 bits)
BYTE[n]
n bytes
BCD[n]
8421 code, n bytes
STRING
GBK encode, if no data, set blank
4.3 Transmission rules
The protocol uses the network byte sequence of big-endian to deliver the word and double word.
The transmission agreement is as follow:--BYTE: transmitted in the form of byte stream;--WORD: transmit the high 8 bits first, then the low 8 bits;--DWORD: transmit the high 24 bits first, then the high 16 bits, at last the low 8 bits.
4.4 Constitution of messages
4.4.1 Message structure
Each message is made up of flag bit, header, message body and check code, the message
structure diagram is shown in figure 1:
Flag bit
Header
Message body
Check code
Figure 1: message structure diagram
4.4.2 Flag bit
Flag bit
Use 0x7e to represent, if 0x7e appears in the check code, header and message body, it is to be
escaped. The escape rules are defined as follows:
0x7e←→0x7d follows by a 0x02;
0x7d←→0x7d follows by a 0x01.
The escape process is as follows:
Whensending message: message encapsulation→ calculate and fill the check code→ escape;
Whenreceiving message: escape restore→ validate check code→ message parse.
e.g.:
Sending a data package of 0x30 0x7e 0x08 0x7d 0x55, the package is encapsulated as follows:
0x7e 0x30 7d 0x02 0x08 0x7d 0x01 0x55 0x7e.
4.4.3 Header
The header content is shown in table 2:
Table 2: Header content
Starting
byte
Field
Data
type
Descriptions and requirements
0
Message ID
WORD
2
Message body
attribute
WORD See figure 2 for the message body attribute format
structure diagram.
4
Terminal
BCD[6] Converse according to the terminal’s own mobile phone
9
phone number
10
Message serial
number
Message
package
encapsulation
item
number after installation. Add number in the front if the
mobile phone number is less than 12 bits, the mainland
phone number add 0, and the Hong Kong, Macao and
Taiwan is based on their domain code.
WORD Loopaccumulatesfrom0accordingto sending sequence.
12
If the relevant identification bit in the message body
attribute determines the message sub-packageing, this
item has content, otherwise it is not.
The message body attribute format structure diagram is shown in figure 2:
15 14 13
12
11
10
9
8
7
6
5
4
3
2
1
0
Reserve
Sub-package
Data encryption
way
Length of the message body
Figure 2: message body attribute format structure diagram
Data encryption way:--bit 10~bit 12 is data encryption identification bit;--When all the three bits are 0, indicates that the message body is not encrypted;--When the tenth bit is 1, indicates the message body is encrypted by the RSA algorithm;--Others reserved.
Sub-package:
When the 13th bit in the message body attribute is 1, indicates the message body is a long
message, sub-package delivery. The specific sub-packageing information is determined by the
message package encapsulation item. If the 13th bit is 0, there’s no message package
encapsulation item field in the message header.
The message package encapsulation item is shown in table 3:
Table 3: message package encapsulation item
Starting
byte
Field
Data type
Descriptions and requirements
0
Total number of packages WORD
The total number of packages after
sub-packageing
2
Package No.
4.4.4 Check code
WORD
Starting from No.1
The check code refers to a byte from the beginning of the header, exclusive or with the next byte
until the previous byte of the check code.
5. Communication connection
5.1 Connection startup
Data daily connections between terminals and platforms can be either TCP or UDP. Terminal
should connect with the platform as soon as it reset, and then send terminal authenticate
message to the platform for authentication immediately after the connection is established.
10
5.2 Maintenance of connection
After connection establishment and terminal authentication succeed and in the absence of
normal data packages, the terminal should periodically send a terminal heartbeat message to the
platform, the platform receives and sends the platform general reply message to the terminal.
The sending period is specified by the terminal parameter.
5.3 Connection disconnected
Both the platform and the terminal can be disconnected according to the TCP protocol, and both
platform and terminal should actively judge whether the TCP connection is disconnected.
Method of the platform determining the connection is disconnected:--According to the TCP protocol, the terminal active disconnects is determined;--A new connection is established from the same identity terminal indicating that the original
connection has disconnected;--Not receiving the message from the terminal within a certain amount of time, such as the
terminal heartbeat.
Method of the terminal determining the connection is disconnected:--According to the TCP protocol, the terminal active disconnects is determined;--The data communication link is disconnected;--The data communication link is normal, after reaching the retransmission times it still hasn’t
received a response.
6. Message processing
6.1 TCPandUDPmessageprocessing
6.1.1 Messages mainly send from the platform
All the messages mainly send from the platform require terminal responses. The responses are
divided into general responses and specific responses, which are decided by the specific
functions. After the sender waiting timeout should resend the message. The response timeout
period and resend times are specified by the platform parameters. Formula of calculating the
response timeout period after resend is shown in formula (1):
TN+1=TN×(N+1)
In the formula:
TN+1--Timeout period after each resend;
TN--The previous response timeout period;
N--Resend times.
6.1.2 Messages mainly send from the terminal
6.1.2.1 The data communication link is normal
…………(1)
When the data communication link is normal, all the messages mainly send from the terminal
require platform responses. The responses are divided into general responses and specific
responses, which are decided by the specific functions. After the terminal is waiting timeout
should resend the message. The response timeout period and resend times are specified by the
platform parameters. The timeout period after resend is calculating according to formula (1). The
key alarm message sent form the terminal will be stored if it is not received after the resend
times is reached. Before sending other messages, it will send the stored key alarm message.
11
6.1.2.2 The data communication link is abnormal
When the data communication link is abnormal, the terminal should store the location
information report that needs to be sent.
6.2 SMSmessagedispose
When the terminal communication mode is switched to the SMS message mode from GSM
network, the PDU eight bit encoding method is adopted. For messages that more than 140 bytes
should be sub-packageed according to the SMS service specification of GSM network.
The response, resend and store mechanism of SMS messages is the same as 6.1 while response
timeout period and resend times should according to parameter ID0x0006 and 0x0007 related
set values in table 10.
7. Protocol classification
7.1 Introduction
The protocol is described by functional classification as follow. If there’s no special mention, the
TCP communication is the default. The communication protocol between the vehicle terminal
and the external equipment is shown in appendix A. The message comparison table of the
message name and message ID in the protocol is shown in appendix B.
7.2 Terminal managementprotocol
7.2.1 Terminal registration/ logout
In the unregistered state, the terminal should be registered first. The terminal will receive the
authentication code and store it after registration, the authentication code will be used when the
terminal log in. Before the vehicle needs to be removed or replaced, the terminal should logout
and cancels the corresponding relationship between the terminal and the vehicle.
If the terminal chooses to send the terminal registration and terminal logout by SMS, the
platform should send response to the terminal registration via SMS, and send platform general
response to the terminal logout by SMS.
7.2.2 Terminal authentication
After the registration of the terminal, each time after connected with the platform, should
authenticate immediately. The terminal shall not send any other information before
authentication success.
The terminal authentication via sending terminal authentication message, the platform responds
platform general response message.
7.2.3 Set/query terminal parameters
The platform sets the terminal parameters by sending the terminal parameter message, and the
terminal responds terminal general response message. The platform queries the terminal
parameters by sending query terminal parameters, terminal responds query terminal parameter
response message.
7.2.4 Terminal control
The platform controls the terminal by sending terminal control message, the terminal responds
terminal general response message.
12
7.3 Location and alarmprotocol
7.3.1 Location information report
The terminal will periodically send the location information report based on the parameters.
According to the parameter control, the terminal can report the location information when the
vehicle is turning.
7.3.2 Location information query
The platform queries the message by sending location information; query the location
information of the car terminal, terminal query response message by responds location
information.
7.3.3 Temporary location tracking control
The platform start/stop location tracking by sending temporary location tracking control. Location
tracking requires period report at the specified time interval before the terminal stop, the
terminal responds terminal general response message.
7.3.4 Terminal alarm
When the terminal determines the alarm condition is met, the location information will be
reported. Set the corresponding alarm sign in the location report, the platform can be used for
alarm processing by responds the platform general response message.
Each alarm type is described in the location information report message body. Alarm sign
maintained to the alarm condition is removed should send location information report message
immediately, to clear the corresponding alarm signs.
7.4 Information protocol
7.4.1 Text information sending
The platform sends out messages by sending text messages and notifies the driver in the
specified way. The terminal responds terminal general response message.
7.4.2 Event setting and reporting
The platform sets the message by sending events, store the event list in the terminal, after
encountering corresponding event, the driver can enter the event list interface to select and
terminal send event report message to the platform.
Setting message by events requires the terminal to responds the terminal general response
message. Event report message requires the platform to responds platform general response
message.
7.4.3 Questions
The platform sends out message by sending questions, sends questions with candidate answers
to the terminal and the terminal shows immediately. The terminal sends question response
message to the platform after the driver selected.
Sends out question messages, requires terminal to responds terminal general response message.
7.4.4 Information on-demand
The message setting of the platform is set by sending message of menu on demand and platform
send information on demand item list to the terminal for storage. Drivers can choose to select
request/cancel corresponding information services via menu, after selection the terminal send
request/cancel message to the platform. After the information service is requested it will receive
information service message from the platform periodically such as news, weather forecast, etc.
The information on-demand menu sets the message requires the terminal responds terminal
13
general response message. Information on-demand/cancel message requires the platform
responds platform general response message. Information service message requires the terminal
responds terminal general response message.
7.5 Telephone protocol
7.5.1 Call back
The platform demands the terminal to call back a designated telephone number through sending
call back message and specifies whether to monitor or not (the terminal does not open the
speaker).
Call back requires the terminal responds terminal general response message.
7.5.2 Set telephone directory
The platform sends setting telephone directory message to set terminal’s telephone directory
which requires the terminal responds terminal general response message.
7.6 Vehicle control protocol
The platform demands the terminal to control vehicle with corresponding operation via sending
vehicle control message. Terminal responds terminal general response message as soon as the
message received. After that terminal controls the vehicle and responds vehicle control response
message according to the result.
7.7 Vehicle management protocol
The platform sets area and route of the terminal via sending: set circle area, rectangle area,
polygon area, set the route message and so on. The terminal judge whether it is satisfied the
alarm condition according to the attribute of area and route. The alarm includes over speed
alarm, enter and exit the area/route alarm and driving time insufficient/too long alarm, the
location information report message should cover additional corresponding location information.
The value range of area or route ID is 1~0XFFFFFFFF. If the set ID is repeated with a same type
area or route ID which is already in the terminal, it will be update.
The platform can also delete the area and route that stored in the terminal through delete circle
area, rectangle area, polygon area, route and so on.
Set/delete area and route message required the terminal responds terminal general response
message.
7.8 Information collection protocol
7.8.1 Collect driver’s identity information data
Insert the occupational qualification certificate IC card in to the terminal reading card module
when driver starts driving, after the module detects the card through the sensor switch. The
terminal forward the authentication request data to the road transport certificate IC card
certification center via pass-through and pass the authentication result from the authentication
center to reading card module. Reading card module read the occupational qualification
certificate IC card via results of the certification, and upload the result through terminal to the
certification center (both success and failure information) and attribution monitoring center (only
successful information)
Pull out the IC card when driver finishes driving. The reading card module uploads relevant
14
information to the certification center and attribution monitoring center through terminal after it
detects the card is gone via the sensor switch.
7.8.2 Collect electronic waybill data
Terminal collects electronic waybill and upload it to the platform.
7.8.3 Collect driving record data
The platform demands the terminal upload specified data through sending driving record data
collection command message which requires the terminal responds driving record upload
message.
7.8.4 Request driving record parameter
The platform demands the terminal upload specified data through sending driving record
parameter request command message which requires the terminal responds terminal general
response message.
7.9 Multimedia protocol
7.9.1 Multimedia event information uploading
The terminal active shooting or recording because of specific events should active upload
multimedia event message immediately after the event happened and the message requires
platform responds general response message.
7.9.2 Multimedia data upload
The terminal upload multimedia data through sending multimedia data upload message.
Location data report message body while shooting and recording should be attached in the front
of each complete multimedia data, which is called location multimedia data. The platform
determines the receiving timeout based on the total package number, after receive the entire
data package or timeout, the platform sends multimedia data upload response message to the
terminal. This message confirms receive the entire data package or requires terminal resends the
specified package.
7.9.3 Camera shot immediately
The platform sends shooting command through sending multimedia data upload message to the
terminal. This message requires the terminal responds terminal general response message. If is
assigned to be real time upload, the terminal upload image/video after shooting/camera
recording, otherwise store the image/video.
7.9.4 Start recording
The platform sends recording command to the terminal through sending start recording
command message which needs the terminal responds terminal general response message. If is
assigned to be real time upload, the terminal upload audio data after recording, otherwise store
the audio data.
7.9.5 Retrieve terminal storing and extracting multimedia data
The platform obtains the situation of the terminal stores multimedia data through sending
storing and extracting multimedia data retrieve message.
According to the retrieval results, the platform can demand the terminal to upload specified
multimedia data by sending storing and extracting multimedia upload message which needs the
terminal to responds terminal general response message.
15
7.10 General datatransfer
Message that undefined in the protocol but needs to be passed in the actual use can use data
uplink pass-through message and data downlink pass-through message to do the up/downlink
data exchange.
The terminal can compress the longer message with GZIP compression algorithm and report the
message with data compression.
7.11 Encryption protocol
The RSA public key cryptosystem can be used to encrypt communication between the platform
and the terminal. The platform informs the terminal of its RSA public key by sending platform RSA
public key message, and the terminal responds terminal RSA public message, and vice versa.
7.12 Sub-package message
When the message is sent by sub-packageing, the sub-package messages serial number should
be in continuous increments.
In response to sub-packageing messages, if there’s no specific response instruction, the receiver
can adopt a generic response to all sub-package messages or use a general answer for each
sub-package message, the result field (success/failure) is used to tell the sender if all the
sub-package messages are received correctly. When all sub-package messages are not received
correctly, the receiver can demand the sender resend the missing sub-package message through
the resend sub-package request command. The sender should use the original message to resend
the sub-package in the resend package ID list, and the resend sub-package is identical to the
original sub-package message.
8. Data format
8.1 Terminal general response
Message ID: 0x0001.
Terminal general response message body data format is shown in table 4.
Table 4: Terminal general response message body data format
Starting
byte
Field
Data
type
Descriptions and requirements
0
Response serial number
WORD
The serial number of the corresponding
platform message
2
Response ID
WORD
The ID of the corresponding platform
message
4
Result
8.2 Platform general response
BYTE
0: success/ok; 1: failure; 2: incorrect
information; 3: not supporting
Message ID: 0x8001.
Platform general response message body data format is shown in table 5.
Table 5: Platform general response message body data format
Starting byte
Field
Data type
Descriptions and requirements
16
17
0 Responseserialnumber WORD Theserial numberof thecorresponding
terminalmessage
2 ResponseID WORD The ID of the corresponding terminal
message
4 Result BYTE 0: success/ok; 1: failure; 2: incorrect
information;3:not supporting;4: alarm
processingconfirmation
8.3Terminalheartbeat
MessageID:0x0002.
Terminalheartbeatdatamessagebodyisnull.
8.4Resendsub-packagerequest
MessageID:0x8003.
Resendsub-packagerequestmessagebodydataformatisshownintable6.
Table6:Resendsub-packagerequestmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 The original message
serialnumber
WORD Theserialnumberofthefirstpackageof
thecorrespondingoriginalmessagethat
isrequiredtoberesent
4 Totalnumberof resend
package
BYTE n
5 ResendpackageIDlist BYTE[2*n] In order of resend package sequence
number, suchas ‘package ID1package
ID2…packageIDn’
Noted:Theresponseofthismessageshouldadoptoriginalmessagetoresendthesub-packageof
resendpackageIDlistwhichisexactlythesameastheoriginalsub-packagemessage.
8.5Terminalregistration
MessageID:0x0100.
Terminalregistrationmessagebodydataformatisshownintable7.
Table7:Terminalregistrationmessagebodydataformat
Starting
byte
Field Data
type
Descriptionsandrequirements
0 ProvincedomainID WORD Indicatetheprovincewheretheterminal isinstalled,
0 is reserved, thedefault value is taken fromthe
platform. Theprovincedomain IDadopts the first
twoof thesixadministrativedivisioncodespecified
inGB/T2260.
2 City and county
domainID
WORD Indicatethecityandcountywheretheterminal is
installed, 0 is reserved, thedefault value is taken
fromtheplatform. Theprovincedomain IDadopts
the last fourof thesixadministrativedivisioncode
specifiedinGB/T2260.
18
4 ManufacturerID BYTE[5] 5bytes,terminalmanufacturercode
9 Terminaltype BYTE[20] 20 bytes, the terminal type is defined by the
manufacturer,whenthedigit isn’tsufficient,append
‘0X00’.
29 TerminalID BYTE[7] 7bytes, consistsofcapital lettersandnumbers, the
terminal ID is definedby themanufacturer,when
thedigitisn’tsufficient,append‘0X00’.
36 Licenseplatecolor BYTE License plate color, according to 5.4.12 in
JT/T415-2006.
Whenthelicensehasn’tregistered, setthevalueas
‘0’.
37 VIN STRING Whenthe licenseplatecolor is0, indicatesvehicle
VIN (vehicle Identification Number); otherwise
indicates the license plate issued by the public
securitytrafficmanagementdepartment.
8.6Terminalregistrationresponse
MessageID:0x8100.
Terminalregistrationresponsemessagebodydataformatisshownintable8.
Table8:Terminalregistrationresponsemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Responseserialnumber WORD Theserial numberof thecorresponding
terminalregistrationmessage
2 Result BYTE 0: success; 1: vehiclehas alreadybeen
registered;2:there’snospecifiedvehicle
indatabase;3:terminalhasalreadybeen
registered; 4: there’s no specified
terminal indatabase
3 Theauthentication
code
STRING Thefieldisonlydisplayaftersuccess
8.7Terminallogout
MessageID:0x0003.
Terminallogoutmessagebodyisnull.
8.8Terminalauthentication
MessageID:0x0102.
Terminalauthenticationmessagedataformatisshownintable9.
Table9:Terminalauthenticationmessagedataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 The authentication
code
STRING Theterminal reportauthenticationcode
afterreconnect.
19
8.9Terminalparametersetting
MessageID:0x8103.
Terminalparametersettingmessagebodydataformatisshownintable10.
Table10:Terminalparametersettingmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Total number of
parameters
BYTE
1 Parameteritemlist Parameter itemformat isshownintable
11
Table11:Terminalparameteritemdataformat
Startingbyte Datatype Descriptionsandrequirements
ParameterID DWORD DefinitionandinstructionofparameterIDisshownin
table12
Lengthofparameter BYTE
Valueofparameter If it is multi-valued parameter, a number of
parametersof a same IDareused in themessage,
suchasdispatchcenterphonenumber
Table12:Terminalparametersettingdefinitionandinstructionofeachparameter
ParameterID Datatype Descriptionsandrequirements
0x0001 DWORD Terminalheartbeatsendinginterval,unitissecond(s)
0x0002 DWORD Time of TCP message response time-out, unit is
second(s)
0x0003 DWORD ResendtimeofTCPmessage
0x0004 DWORD Time of UDPmessage response time-out, unit is
second(s)
0x0005 DWORD ResendtimeofUDPmessage
0x0006 DWORD Time of SMS message response time-out, unit is
second(s)
0x0007 DWORD ResendtimeofSMSmessage
0x0008-0x000F Reserve
0x0010 STRING MainserverAPN,wirelesscommunicationdialsaccess
point. If thenetworkmodeisCDMA,hereisPPPdial
number
0x0011 STRING User name ofmain serverwireless communication
dialing
0x0012 STRING Password of main server wireless communication
dialing
0x0013 STRING Address,IDordomainnameofmainserver
0x0014 STRING Backup server APN, wireless communication dials
accesspoint
0x0015 STRING Backup server wireless communication dials user
20
name
0x0016 STRING Backupserverwirelesscommunicationdialspassword
0x0017 STRING Backupserveraddress,IPordomainname
0x0018 DWORD Server’sTCPport
0x0019 DWORD Server’sUDPport
0x001A STRING RoadtransportcertificateICcardauthenticationmain
serverIPaddressordomainname
0x001B DWORD RoadtransportcertificateICcardauthenticationmain
serverTCPport
0x001C DWORD RoadtransportcertificateICcardauthenticationmain
serverUDPport
0x001D STRING Road transport certificate IC card authentication
backup server IP address or domainname, port is
sameasmainserver
0x001E-0x001F Reserve
0x0020 DWORD Strategy of position reporting, 0: timing report; 1:
reportatacertaindistance;2:bothtimingandreport
atacertaindistance
0x0021 DWORD Scheme of position reporting, 0: according to the
statusofACC;1:accordingtothestatusof loginand
ACC, check the loginstatus first, then the statusof
ACC
0x0022 DWORD Reporttimeintervalswhilethedrivernotlogin,unitis
second(s),>0
0x0023-0x0026 DWORD Reserve
0x0027 DWORD Reporttimeintervalsduringdormancy,unit issecond
(s),>0
0x0028 DWORD Reporttimeintervalsduringemergencyalarm,unit is
second(s),>0
0x0029 DWORD Report time intervalswhen default, unit is second
(s),>0
0x002A-0x002B DWORD Reserve
0x002C DWORD Report distance intervalwhendefault, unit ismeter
(m),>0
0x002D DWORD Report distance intervalswhile thedriver not login,
unitismeter(m),>0
0x002E DWORD Report distance intervals during dormancy, unit is
meter(m),>0
0x002F DWORD Report distance intervals during emergency alarm,
unitismeter(m),>0
0x0030 DWORD Angleoftheinflectionpoint,<180
0x0031 WORD Geo-fence radius (irregular displacement threshold),
unitismeter
21
0x0032-0x003F Reserve
0x0040 STRING Phonenumberofthemonitorplatform
0x0041 STRING Phonenumber of reset, which canbeused tocall
terminaltoresetit
0x0042 STRING Phonenumberof factoryreset,whichcanbeusedto
callterminaltolettheterminalrestorefactorysetting
0x0043 STRING SMSphonenumberofthemonitorplatform
0x0044 STRING NumberofreceiveterminalSMStextalarm
0x0045 DWORD Strategy of terminal phone answering, 0:
automaticallyanswer; 1: automaticallyanswerwhile
ACCisON,manuallyanswerwhileACCisOFF
0x0046 DWORD Thelongestcallingtimeeachtime,unitissecond(s),0
stands fornotallowedtocall, 0xFFFFFFFFstands for
notlimit
0x0047 DWORD The longest calling timeeachmonth, unit is second
(s),0standsfornotallowedtocall,0xFFFFFFFFstands
fornotlimit
0x0048 STRING Phonenumberofmonitor
0x0049 STRING SMSnumberofregulatoryplatformprivilege
0x004A-0x004F Reserve
0x0050 DWORD Alarmblockedfield, correspondingtothealarmsign
in the position information report message, the
corresponding alarm is blocked when the
correspondingfieldis1
0x0051 DWORD Alarmsendingtext,SMSswitch,correspondingtothe
alarmsigninthepositioninformationreportmessage,
thecorrespondingSMStextofthealarmissentwhen
thecorrespondingfieldis1
0x0052 DWORD Alarmshooting switch, corresponding to the alarm
sign intheposition informationreportmessage, the
camera shootwhenalarmwhen the corresponding
fieldis1
0x0053 DWORD Alarmshooting storage sign, corresponding to the
alarmsigninthepositioninformationreportmessage,
store the pictures shoot when alarmwhen the
correspondingfieldis1,otherwisereal-timeupload
0x0054 DWORD Thekeysign, correspondingtothealarmsign inthe
position information report message, the
corresponding alarm is key alarm when the
correspondingfieldis1
0x0055 DWORD Thehighestspeed,unitiskm/h
0x0056 DWORD Thedurationofover-speed,unitissecond(s)
0x0057 DWORD Continuousdrivingtimelimit,unitissecond(s)
0x0058 DWORD Accumulateddriving time of the same day, unit is
22
second(s)
0x0059 DWORD Minimumresttime,unitissecond(s)
0x005A DWORD Maximumparkingtime,unitissecond(s)
0x005B WORD The difference between over-speed alarm and
warning,unitis1/10Km/h
0x005C WORD The difference between fatigue driving alarmand
warning,unitissecond(s),>0
0x005D WORD Settingofcollisionalarmparameters:
b7-b0:collisiontime,unit4ms;
b15-b8:collisionacceleration,unit0.1g,settingranges
between0and79,thedefaultis10
0x005E WORD Settingofrolloveralarmparameters:
Angle of rollover, unit 1 degree, the default is 30
degrees
0x005F-0x0063 Reserve
0x0064 DWORD Timingshootingcontrol,shownintable13
0x0065 DWORD Shootingcontrolatacertaindistance, shownintable
14
0x0066-0x006F Reserve
0x0070 DWORD Qualityofimage/video,1-10,1forthebest
0x0071 DWORD Brightness,0-255
0x0072 DWORD Contrast,0-127
0x0073 DWORD Saturability,0-127
0x0074 DWORD Chromaticity,0-255
0x0075-0x007F
0x0080 DWORD Vehicleodometerreading,1/10km
0x0081 WORD ProvincedomainIDofvehicle
0x0082 WORD CitydomainIDofvehicle
0x0083 STRING Registrationnumberofmotorvehicleissuedbypublic
securitytrafficmanagementdepartment
0x0084 BYTE The license plate color, according to 5.4.12 in
JT/T415-2006
0x0090 BYTE DefinitionofGNSSpositioningmodeisasfollows:
bit0, 0: disable GPS positioning, 1: enable GPS
positioning,; bit1, 0: disable Beidou positioning, 1:
enableBeidoupositioning; bit2, 0: disableGLONASS
positioning, 1: enableGLONASSpositioning; bit3, 0:
disable Galileo positioning, 1: enable Galileo
positioning
0x0091 BYTE DefinitionofGNSSbaudrateisasfollows:
0x00:4800;0x01:9600;
0x02:19200;0x03:38400;
0x04:57600;0x05:115200
23
0x0092 BYTE Definition of GNSS module detailed location data
outputfrequencyisasfollows:
0x00:500ms;0x01:1000ms(default);
0x02:2000ms;0x03:3000ms;
0x04:4000ms
0x0093 DWORD GNSSmoduledetailedlocationdatacollectfrequency,
unitissecond,defaultis1
0x0094 BYTE UploadmodeofGNSSmoduledetailedlocationdata:
0x00,localstorage,donotupload(default);
0x01,uploadintimeinterval;
0x02,uploadindistanceinterval;
0x0B,uploadinaccumulativetime,automaticallystop
uploadingafterreachingtransmissiontime;
0x0C, upload inaccumulativedistance, automatically
stopuploadingafterreachingacertaindistance
0x0D, upload in accumulative number of data,
automatically stop uploading after reaching the
numberofuploads
0x0095 DWORD UploadsettingofGNSSmoduledetailedlocationdata:
whenuploadmodeis0x01,unitissecond;
whenuploadmodeis0x02,unitismeter;
whenuploadmodeis0x0B,unitissecond;
whenuploadmodeis0x0C,unitismeter;
whenuploadmodeis0x0D,unitisitem
0x0100 DWORD CANbus channel 1collect time interval (ms), 0 for
don’tcollect
0x0101 WORD CANbuschannel1uploadtimeinterval(s),0fordon’t
upload
0x0102 DWORD CANbus channel 2collect time interval (ms), 0 for
don’tcollect
0x0103 WORD CANbuschannel2uploadtimeinterval(s),0fordon’t
upload
0x0110 BYTE[8] SeparatecollectionsettingofCANbusID:
bit63-bit32standforcollecttimeinterval (ms)of this
ID,0fordon’tcollect;
bit31forCANchannelnumber,0:CAN1,1:CAN2;
bit30 is frame type, 0: standard frame, 1: extended
frame;
bit29fordatacollectionway, 0: theoriginal data, 1:
thecalculatedvalueofthecollectioninterval;
bit28-bit0forCANbusID
0x0111-0x01FF BYET[8] ForotherCANbusIDseparatelycollectsettings
0xF000-0xFFFF Userdefined
24
Table13:Definitionoftimingshootingcontrolbit
Bit Definition Descriptionsandrequirements
0 Camerachannel1timingshootingswitchsign 0:notallowed;1:allowed
1 Camerachannel2timingshootingswitchsign 0:notallowed;1:allowed
2 Camerachannel3timingshootingswitchsign 0:notallowed;1:allowed
3 Camerachannel4timingshootingswitchsign 0:notallowed;1:allowed
4 Camerachannel5timingshootingswitchsign 0:notallowed;1:allowed
5-7 Reserve
8 Camerachannel1timingshootingstoragesign 0:store;1:upload
9 Camerachannel2timingshootingstoragesign 0:store;1:upload
10 Camerachannel3timingshootingstoragesign 0:store;1:upload
11 Camerachannel4timingshootingstoragesign 0:store;1:upload
12 Camerachannel5timingshootingstoragesign 0:store;1:upload
13-15 Reserve
16 Timingtimeunit 0: second,whenlessthan5s, terminal
processedas5s;1:minute
17-31 Timingtimeinterval Execute after receiving parameter
settingsorrestart
Table14:Definitionofcertaindistanceshootingcontrolbit
Bit Definition Descriptionsandrequirements
0 Camera channel 1 certain distance shooting
switchsign
0:notallowed;1:allowed
1 Camera channel 2 certain distance shooting
switchsign
0:notallowed;1:allowed
2 Camera channel 3 certain distance shooting
switchsign
0:notallowed;1:allowed
3 Camera channel 4 certain distance shooting
switchsign
0:notallowed;1:allowed
4 Camera channel 5 certain distance shooting
switchsign
0:notallowed;1:allowed
5-7 Reserve
8 Camera channel 1 certain distance shooting
storagesign
0:store;1:upload
9 Camera channel 2 certain distance shooting
storagesign
0:store;1:upload
10 Camera channel 3 certain distance shooting
storagesign
0:store;1:upload
11 Camera channel 4 certain distance shooting
storagesign
0:store;1:upload
12 Camera channel 5 certain distance shooting
storagesign
0:store;1:upload
13-15 Reserve
25
16 Certaindistanceunit 0: meter, when less than 100m,
terminal processed as 100m; 1:
kilometer
17-31 Certaindistanceinterval Execute after receiving parameter
settingsorrestart
8.10Checkterminalparameter
MessageID:0x8104.
Checkterminalparametermessagebodyisnull.
8.11Checkspecifiedterminalparameters
MessageID:0x8106.
Checkspecifiedterminalparametersmessagebodydataformat isshownintable15, terminal
use0x0104instructionsforresponse.
Table15:Checkspecifiedterminalparametersmessagebodydataformat
Starting
byte
Field Datatype Descriptionsandrequirements
0 Total number of
parameter
BYTE Totalnumberofparameterisn
1 ParameterIDlist BYTE[4*n] Arrangeinorderofparameter,e.g. ‘parameter ID1
parameterID2……parameterIDn’
8.12Checkterminalparameterresponse
MessageID:0x0104.
Checkterminalparameterresponsemessagebodydataformatisshownintable16.
Table16:Checkterminalparameterresponsemessagebodydataformat
Starting
byte
Field Datatype Descriptionsandrequirements
0 Response serial
number
WORD Checkmessageserialnumberofcorresponding
terminalparameter
2 Number of response
parameter
BYTE
3 Parameteritemlist Parameter itemformatanddefinitionisshown
intable10
8.13Terminalcontrol
MessageID:0x8105.
Terminalcontrolmessagebodydataformatisshownintable17.
Table17:Terminalcontrolmessagebodydataformat
Starting
byte
Field Datatype Descriptionsandrequirements
0 Command BYTE Terminalcontrolcommandinstructionisshown
intable18
1 Commandparameter STRING Command parameter format see below for
26
details,eachfieldisseparatedbyahalfangle‘;’,
each STRING field is processed with GBK
encodingbeforethemessageiscomposed
Table18:Terminalcontrolcommandinstruction
Command Commandparameter Descriptionsandrequirements
1 Command parameter
format is shown in
table19
Wireless upgrade. The parameters are separated by
semicolons. Instructionsareasfollows: ‘URLaddress;dial
peers name; dial-up username; dial-up password;
address;TCPport;UDPport;manufacturersID;hardware
version; firmwareversion; time limit of connect to the
specifiedserver’,ifaparameterhasnovalue,it’sempty.
2 Command parameter
format is shown in
table19
Thecontrolterminalconnectstothespecifiedserver.The
parametersareseparatedbysemicolons. Instructionsare
as follows: ‘connection control; authentication codeof
monitor platform; dial peers name; dial-up username;
dial-uppassword;address;TCPport;UDPport;timelimit
ofconnecttothespecifiedserver’, ifaparameterhasno
value, it’s empty; if the connection control value is 1,
there’snosubsequentparameter
3 null Terminalpoweroff
4 null Terminalreset
5 null Terminalfactoryreset
6 null Turnoffdatacommunication
7 null Closeallwirelesscommunication
Table19:Commandparameterformat
Field Datatype Descriptionsandrequirements
Connectioncontrol BYTE 0: switchtothespecifiedmonitoringplatformserver,
entertheemergencystatusafterconnecttotheserver.
Inthis status, only the supervisoryplatformwith the
control instruction can send the control instructions
including SMS; 1: switchback to theoriginal default
monitoringplatformserverandreturntonormal
Dialpeersname STRING It is typically the server APN,wireless dial-upaccess
point. If thenetworkmode isCDMA, thevalue is the
PPPconnectiondialnumber
Dial-upusername STRING Serverwirelesscommunicationdial-upusername
Dial-uppassword STRING Serverwirelesscommunicationdial-uppassword
Address STRING Serveraddress,IPordomainname
TCPport WORD ServerTCPport
UDPport WORD ServerUDPport
ManufacturersID BYTE[5] Terminalmanufacturerscode
Authenticationcodeof STRING The authentication code issued by the regulatory
27
monitorplatform platform, onlyused for authenticationafter terminal
connects to the regulatory platform. Terminal use
original authentication code after connect to the
originalmonitoringplatform
Hardwareversion STRING The hardware version number of the terminal, is
determinedbythemanufacturer
Firmwareversion STRING The firmware version number of the terminal, is
determinedbythemanufacturer
URLaddress STRING CompleteURLaddress
Time limit of connect
tothespecifiedserver
WORD Unit: minute, if the value isn’t 0 indicates that the
terminal should be returned to the original address
before the terminal receives an upgrade or an
instructionof connect to the specified server. If the
value is0 indicatesconnect tothespecifiedserverall
thetime.
8.14Checkterminalattribute
MessageID:0x8107.
Checkterminalattributemessagebodyisnull.
8.15Checkterminalattributeresponse
MessageID:0x0107.
Checkterminalattributeresponsemessagebodydataformatisshownintable20.
Table20:Checkterminalattributeresponsemessagebodydataformat
Starting
byte
Field Data
type
Descriptionsandrequirements
0 Terminaltype WORD bit0,0:passengervehiclesarenotapplicable,1:
passengervehiclesareapplicable;
bit1, 0: dangerous goods vehicles are not
applicable, 1: dangerous goods vehicles are
applicable;
bit2, 0: ordinary freight vehicles are not
applicable, 1: ordinary freight vehicles are
applicable;
bit3,0: rental carsarenotapplicable,1: rental
carsareapplicable;
bit6,0:harddiskvideoisnotsupported,1:hard
diskvideoissupported;
bit7,0:all-in-onemachine,1:splitmachine
2 ManufacturersID BYTE[5] 5bytes,terminalmanufacturercode
7 Terminalmodel BYTE[20] 20bytes, thisterminalmodel isdeterminedby
manufacturer, when the digit isn’t sufficient,
append‘0X00’
27 TerminalID BYTE[7] 7bytes,consistsofcapital lettersandnumbers,
28
thisterminal IDisdeterminedbymanufacturer,
whenthedigitisn’tsufficient,append‘0X00’
42 TerminalSIMcardICCID BCD[10] TerminalSIMcardICCIDnumber
52 Lengthof the terminal
hardwareversionNo.
BYTE n
53 The terminal hardware
versionNo.
STRING
53+n Lengthof the terminal
firmwareversionNo.
BYTE m
54+n The terminal firmware
versionNo.
STRING
54+n+m GNSSmoduleattribute BYTE bit0,0:GPSpositioningisnotsupported,1:GPS
positioningissupported;
bit1,0:Beidoupositioningisnotsupported,1:
Beidoupositioningissupported;
bit2,0:GLONASSpositioning isnotsupported;
1:GLONASSpositioningissupported;
bit3,0:Galileopositioningisnotsupported;1:
Galileopositioningissupported
55+n+m Communicationmodule
attribute
BYTE bit0,0:GPRScommunicationisnotsupported,
1:GPRScommunicationissupported;
bit1,0:CDMAcommunicationisnotsupported,
1:CDMAcommunicationissupported;
bit2, 0: TD-SCDMA communication is not
supported, 1: TD-SCDMA communication is
supported;
bit3, 0: WCDMA communication is not
supported, 1: WCDMA communication is
supported;
bit4, 0: CDMA2000 communication is not
supported, 1: CDMA2000 communication is
supported;
bit5, 0: TD-LTE communication is not
supported, 1: TD-LTE communication is
supported;
bit7, 0: other communication way is not
supported, 1: other communication way is
supported
8.16Senddownterminalupdatepacket
MessageID:0x8108.
Senddownterminalupdatepacketmessagebodydataformatisshownintable21.Theterminal
usesageneral response for thecommandtoverify that theupgradepacketdata is received
correctly.
29
Table21:Senddownterminalupdatepacketmessagebodydataformat
Starting
byte
Field Data
type
Descriptionsandrequirements
0 Upgradetype BYTE 0: terminal, 12: road transport certificate IC
card reader, 52: Beidou satellite positioning
module
1 ManufacturerID BYTE[5] Manufacturerserialnumber
6 LengthofversionNo. BYTE n
7 VersionNo. STRING
7+n Length of upgrade
packet
DWORD Unitisbyte
11+n Upgradepacket
8.17Notificationofterminalupgradesresults
MessageID:0x0108.
Terminalusesthiscommandtonotifymonitoringcenterafterupgradecompletesandreconnects.
Notificationofterminalupgradesresultsmessagebodydataformatisshownintable22.
Table22:Notificationofterminalupgradesresultsmessagebodydataformat
Starting
byte
Field Data
type
Descriptionsandrequirements
0 Upgradetype BYTE 0: terminal, 12: road transport certificate IC
card reader, 52: Beidou satellite positioning
module
1 Upgraderesult BYTE 0:success,1:failure,2:cancel
8.18Locationinformationreport
MessageID:0x0200.
Location information reportmessage body is composed of location basic information and
locationadditional informationitemlist,themessagestructurediagramisshowninfigure3:
Locationbasicinformation Locationadditional informationitemlist
Figure3:Locationreportmessagestructurediagram
Locationadditional information itemlist is composedof each locationadditional information
itemsornot,it’sdeterminesbythelengthfieldintheheader.
Locationbasicinformationdataformatisshownintable23.
Table23:Locationbasicinformationdataformat
Starting
byte
Field Data
type
Descriptionsandrequirements
0 Alarmsign DWORD Definitionofalarmsignbitisshownintable24
4 Status DWORD Definitionofstatusbitisshownintable25
8 Latitude DWORD Unit is degree, times the sixthpower of 10,
accuratetoonemillionthdegree
12 Longitude DWORD Unit is degree, times the sixthpower of 10,
accuratetoonemillionthdegree
16 Altitude WORD Altitude,unitismeter(m)
30
18 Speed WORD 1/10km/h
20 Direction WORD 0-359,duenorthis0,clockwise
21 Time BCD[6] YY-MM-DD-hh-mm-ss (GMT+8 time, the time
involvedinthisstandardisinthistimezone)
Table24:Definitionofalarmsignbit
Bit Definition Processingspecification
0 1: Emergency alarm,
trigger after triggering
alarmswitch
Zeroclearingafterreceivetheresponse
1 1:Overspeedalarm Thesignismaintaineduntilthealarmconditionisrelieved
2 1: Driving alarm
malfunction
Thesignismaintaineduntilthealarmconditionisrelieved
3 1:Riskwarning Zeroclearingafterreceivetheresponse
4 1: GNSS module
malfunction
Thesignismaintaineduntilthealarmconditionisrelieved
5 1:GNSSantennawasnot
connectedorcut
Thesignismaintaineduntilthealarmconditionisrelieved
6 1: GNSS antenna short
circuited
Thesignismaintaineduntilthealarmconditionisrelieved
7 1: The terminal main
powerundervoltage
Thesignismaintaineduntilthealarmconditionisrelieved
8 1: The terminal main
poweristurnedoff
Thesignismaintaineduntilthealarmconditionisrelieved
9 1:TerminalLCDordisplay
malfunction
Thesignismaintaineduntilthealarmconditionisrelieved
10 1: TTS module
malfunction
Thesignismaintaineduntilthealarmconditionisrelieved
11 1:Cameramalfunction Thesignismaintaineduntilthealarmconditionisrelieved
12 1: Road transport
certificateICcardmodule
malfunction
Thesignismaintaineduntilthealarmconditionisrelieved
13 1:Overspeedwarning Thesignismaintaineduntilthealarmconditionisrelieved
14 1: Fatigue driving
warning
Thesignismaintaineduntilthealarmconditionisrelieved
15-17 Reserve
18 1: Theaccumulatedover
speeddrivingtimeofthe
day
Thesignismaintaineduntilthealarmconditionisrelieved
19 1:Timeoutparking Thesignismaintaineduntilthealarmconditionisrelieved
20 1:Enterandexitthearea Zeroclearingafterreceivetheresponse
21 1: Enter and exit the
route
Zeroclearingafterreceivetheresponse
31
22 1:Thedrivingtimeofthe
route is not enough/too
long
Zeroclearingafterreceivetheresponse
23 1:Offtrackalarm Thesignismaintaineduntilthealarmconditionisrelieved
24 1: Vehicle VSS
malfunction
Thesignismaintaineduntilthealarmconditionisrelieved
25 1:Abnormal fuelcapacity
ofvehicle
Thesignismaintaineduntilthealarmconditionisrelieved
26 1: The vehicle is stolen
(through vehicle burglar
alarm)
Thesignismaintaineduntilthealarmconditionisrelieved
27 1: Illegal ignition of
vehicle
Zeroclearingafterreceivetheresponse
28 1: Illegaldisplacementof
vehicle
Zeroclearingafterreceivetheresponse
29 1:Collisionwarning Thesignismaintaineduntilthealarmconditionisrelieved
30 1:Rolloverwarning Thesignismaintaineduntilthealarmconditionisrelieved
31 1: Illegal open doors
alarm(whentheterminal
notsetup, it’snotjudged
illegalopendoors)
Zeroclearingafterreceivetheresponse
Noted:Thelocationinformationshouldbereportedassoonasalarmandwarningoccurs.
Table25:Definitionofstatusbit
Bit Status
0 0:ACCoff;1:ACCon
1 0:Notpositioning;1:Positioning
2 0:Northlatitude;1:Southlatitude
3 0:Eastlongitude;1:Westlongitude
4 0:Runningstatus;1:Stoprunningstatus
5 0: Latitude and longitude arenot encryptedby secret plug-ins; 1:
Latitudeandlongitudeareencryptedbysecretplug-ins
6-7 Reserve
8-9 00:Emptyload;01:Halfload;02:Reserve;3:Full load
(It canbeused forempty/heavypassenger car andempty/full load
statusofthetruck,manual inputorsensoracquisition)
10 0:Vehicleoil lineisnormal;1:Vehicleoil linedisconnect
11 0:Vehiclecircuitisnormal;1:Vehiclecircuitdisconnect
12 0:Vehicledoorunlocked;1:Vehicledoorlocked
13 0:Door1close;1:Door1open(frontdoor)
14 0:Door2close;1:Door2open(middledoor)
15 0:Door3close;1:Door3open(backdoor)
16 0:Door4close;1:Door4open(doorofdriver’sseat)
32
17 0:Door5close;1:Door5open(user-defined)
18 0:NoGPSpositioning;1:GPSpositioning
19 0:NoBeidoupositioning;1:Beidoupositioning
20 0:NoGLONASSpositioning;1:GLONASSpositioning
21 0:NoGalileopositioning;1:Galileopositioning
22-31 Reserve
Noted:Thelocationinformationshouldbereportedassoonasstatuschanges.
Locationadditional informationitemformatisshownintable26.
Table26:Locationadditionalinformationitemformat
Field Datatype Descriptionsandrequirements
Additional informationID BYTE 1-255
Lengthofadditional information BYTE
Additional information Definitionofadditional informationisshownin
table27
Table27:Definitionofadditionalinformation
Additional
informationID
Length of
additional
information
Descriptionsandrequirements
0x01 4 Mileage, DWORD, 1/10km, corresponding to the odometer
readingofthecar
0x02 2 Fuel capacity,WORD,1/10L, correspondingtothefuel gauge
ofthecar
0x03 2 Speedfromthedrivingrecordfunction,WORD,1/10km/h
0x04 2 Alarmevent IDneedsmanual confirmation,WORD, count
from1
0x05-0x10 Reserve
0x11 1or5 Overspeedalarmadditional informationisshownintable28
0x12 6 Enterandexit thearea/routealarmadditional informationis
shownintable29
0x13 7 Thedriving timeof the route isnotenough/too longalarm
additional informationisshownintable30
0x14-0x24 Reserve
0x25 4 Expandvehiclesignalstatusbit,definitionisshownintable31
0x2A 2 I
0x2B 4 Analog,bit0-15,AD0bit16-31,AD1
0x30 1 BYTE,strengthofwirelesscommunicationnetworksignal
0x31 1 BYTE,GNSSpositioningsatellitenumber
0xE0 Lengthof the
subsequent
information
Lengthofthesubsequentcustominformation
0xE1-0xFF Customarea
33
Table28:Overspeedalarmadditionalinformationmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Locationtype BYTE 0:Nospecificposition;
1:Circlearea;
2:Rectanglearea;
3:Polygonarea;
4:Route
1 AreaorrouteID DWORD There’snothisfieldiflocationtypeis0
Table29:Enterandexitthearea/routealarmadditionalinformationmessagebodydata
format
Startingbyte Field Datatype Descriptionsandrequirements
0 Locationtype BYTE 1:Circlearea;
2:Rectanglearea;
3:Polygonarea;
4:Route
1 AreaorrouteID DWORD
5 Direction BYTE 0:In
1:Out
Table30:Thedrivingtimeoftherouteisnotenough/toolongalarmadditionalinformation
messagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 RouteID DWORD
4 Driving time of
theroute
WORD Unitissecond(s)
6 Result BYTE 0:Notenough;1:Toolong
Table31:Expandvehiclesignalstatusbit
Bit Definition
0 1:Lowbeamsignal
1 1:Highbeamsignal
2 1:Rightindicatorsignal
3 1:Leftindicatorsignal
4 1:Brakesignal
5 1:Reversesignal
6 1:Foglightsignal
7 1:Outlinemarkerlamps
8 1:Trumpetsignal
9 1:Air-conditionerstatus
10 1:Neutralgearsignal
11 1:Retarderoperation
34
12 1:ABSoperation
13 1:Heateroperation
14 1:Clutchstatus
15-31 Reserve
Table32:IOstatusbit
Bit Definition
0 1:Deepdormancy
1 1:Dormancy
2-15 Reserve
8.19Locationinformationquery
MessageID:0x8201.
Locationinformationquerymessagebodyisnull.
8.20Locationinformationqueryresponse
MessageID:0x0201.
Locationinformationqueryresponsemessagebodydataformatisshownintable33.
Table33:Locationinformationqueryresponsemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Response serial
number
WORD Serial number of corresponding location
informationquerymessage
2 Location
informationreport
Locationinformationreportisshownin8.21
8.21Temporarylocationtrackingcontrol
MessageID:0x8202.
Temporarylocationtrackingcontrolmessagebodydataformatisshownintable34.
Table34:Temporarylocationtrackingcontrolmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Timeinterval WORD Unit issecond(s),stoptrackingif is0which
doesnotneedtocarryasubsequentfield
2 Location tracking
validity
DWORD Unit is second (s), after received location
tracking control message, terminal sends
location report according to the time
intervalfromthemessagebeforevalidity
8.22Manuallyconfirmalarmmessage
MessageID:0x8203
Manuallyconfirmalarmmessagebodydataformatisshownintable35.
Table35:Manuallyconfirmalarmmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Alarm message
serialnumber
WORD Alarmmessageserial numberneeds tobe
confirmedmanually, 0 for allmessages of
35
thistypeofalarm
2 Manually confirm
alarmtype
DWORD Definitionisshownintable36
Table36:Definitionofmanuallyconfirmalarmtype
Bit Definition
0 1:Confirmemergencyalarm
1-2 Reserve
3 1:Confirmriskwarning
4-19 Reserve
20 1:Confirmenterandexitareaalarm
21 1:Confirmenterandexitroutealarm
22 1:Confirmdrivingtimeofroutenotenough/toolongalarm
23-26 Reserve
27 1:Confirmvehicleillegalignitionalarm
28 1:Confirmvehicleillegaldisplacementalarm
29-31 Reserve
8.23Senddowntextinformation
MessageID:0x8300.
Senddowntextinformationmessagebodydataformatisshownintable37.
Table37:Senddowntextinformationmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Sign BYTE Definition of text information sign bit is
shownintable38
1 Textinformation STRING Themaximumis1024bytes,codedbyGBK
Table38:Definitionoftextinformationsignbit
Bit Sign
0 1:Emergency
1 Reserve
2 1:Displaybyterminaldisplayer
3 1:TerminalTTSreading
4 1:Displaybyadvertisingscreen
5 0:Centralnavigationinformation;1:CANfaultcodeinformation
6-7 Reserve
8.24Eventsetting
MessageID:0x8301.
Eventsettingmessagebodydataformatisshownintable39.
Table39:Eventsettingmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Settingtype BYTE 0: Delete all existing events from the
36
terminal, this commanddoes not carry a
subsequentbyte;
1:Upgradeevents;
2:Appendevents;
3:Modifyevents;
4:Deletespecificevents, there’snoneedto
carryeventcontentinthefolloweventitem
1 Total number of
setting
BYTE
2 Eventitemlist Compositionof event itemdata format is
shownintable40
Table40:Compositionofeventitemdataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 EventID BYTE Overwritten if the terminal has an event
withasameID
1 Length of event
content
BYTE Byte length of subsequent event content
field
2 Eventcontent STRING Eventcontent,codedbyGBK
8.25Eventreport
MessageID:0x0301.
Eventreportmessagebodydataformatisshownintable41.
Table41:Eventreportmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 EventID BYTE
8.26Questionsendsdown
MessageID:0x8302.
Questionsendsdownmessagebodydataformatisshownintable42.
Table42:Questionsendsdownmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Sign BYTE Definitionofquestionsendsdownsignbitis
shownintable43
1 Length of the
question
BYTE Bytelengthofquestionfield
2 Question STRING Questiontext,codedbyGBK,lengthisN
2+N List of candidate
answer
Compositionof candidateanswermessage
isshownintable44
Table43:Definitionofquestionsendsdownsignbit
Bit Sign
0 1:Emergency
1 Reserve
37
2 Reserve
3 1:TerminalTTSreading
4 1:Displaybyadvertisingscreen
5-7 Reserve
Table44:Compositionofquestionsendsdowncandidateanswermessage
Startingbyte Field Datatype Descriptionsandrequirements
0 AnswerID BYTE
1 Length of answer
content
WORD Bytelengthofanswercontentfield
3 Answercontent STRING Answercontent,codedbyGBK
8.27Questionresponse
MessageID:0x0302.
Questionresponsemessagebodydataformatisshownintable45.
Table45:Questionresponsemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Response serial
number
WORD Serial number of corresponding question
sendsdownmessage
2 AnswerID BYTE AnswerIDcomeswithquestionsendsdown
8.28Informationon-demandmenusetting
MessageID:0x8303.
Informationon-demandmenusettingmessagebodydataformatisshownintable46.
Table46:Informationon-demandmenusettingmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Settingtype BYTE 0:Deleteallinformationitemofterminal;
1:Upgrademenu;
2:Appendmenu;
3:Modifymenu
1 Total number of
informationitem
BYTE
2 Listof information
item
Composition of information on-demand
information itemdata format is shown in
table47
Table47:Compositionofinformationon-demandinformationitemdataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Informationtype BYTE Overwritteniftheterminalhassametypeof
informationitem
1 Length of
informationname
WORD Bytelengthofinformationnamefield
3 Informationname STRING CodedbyGBK
38
8.29Informationon-demand/cancels
MessageID:0x0303.
Informationon-demand/cancelsmessagebodydataformatisshownintable48.
Table48:Informationon-demand/cancelsmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Informationtype BYTE
1 on-demand/cancel
sign
BYTE 0:Cancel;1:On-demand
8.30Informationservice
MessageID:0x8304.
Informationservicemessagebodydataformatisshownintable49.
Table49:Informationservicemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Informationtype BYTE
1 Informationlength WORD
3 Information
content
STRING CodedbyGBK
8.31Callback
MessageID:0x8400.
Callbackmessagebodydataformatisshownintable50.
Table50:Callbackmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Sign BYTE 0:Ordinarycalls;1:Monitoring
1 Phonenumber STRING Themaximumis20bytes
8.32Phonebooksetting
MessageID:0x8401.
Phonebooksettingmessagebodydataformatisshownintable51.
Table51:Phonebooksettingmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Settingtype BYTE 0:Deleteall thecontactsthatstoredinthe
terminal;
1: Update phone book (delete all the
contacts in the terminal, and append
contactsfromthemessage);
2:Appendphonebook;
3: Modify phone book (indexed with
contact)
1 Total number of
contacts
BYTE
2 Contactitem Phone book contact itemdata format is
shownintable52
39
Table52:Phonebookcontactitemdataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Sign BYTE 1: Incoming call; 2: Outgoing call; 3:
Incoming/outgoingcall
1 Lengthofnumbers BYTE
2 Phonenumbers STRING Lengthisn
2+n Lengthofcontacts BYTE
3+n Contacts STRING CodedbyGBK
8.33Vehiclecontrol
MessageID:0x8500
Vehiclecontrolmessagebodydataformatisshownintable53.
Table53:Vehiclecontrolmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Controlsign BYTR Control command sign bit data format is
shownintable54
Table54:Controlcommandsignbitdataformat
Bit Sign
0 0:Cardoorsunlocked;1:Cardoorslocked
1-7 Reserve
8.34Vehiclecontrolresponse
MessageID:0x0500.
Vehiclecontrolresponsemessagebodydataformatisshownintable55.
Table55:Vehiclecontrolresponsemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Response serial
number
WORD Serial number in corresponding to the
vehiclecontrolmessage
2 Location
informationreport
messagebody
Determinewhetherthecontrol issuccessful
ornotaccordingtothecorrespondingstatus
bit
8.35Settingcirclearea
MessageID:0x8600.
Settingcircleareamessagebodydataformatisshownintable56
Noted:Thismessageprotocol
Table56:Settingcircleareamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Settingattribute BYTE 0:Upgradearea;
1:Appendarea;
2:Modifyarea
1 Total number of BYTE
40
areas
2 Areaitem Content of circle area’s area item data
formatisshownintable57
Table57:Contentofcirclearea’sareaitemdataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 AreaID DWORD
4 Areaattribute WORD Definitionofareaattributeisintable58
6 Latitudeof central
point
DWORD The unit of latitude is degree, times the
sixthpowerof10,accuratetoonemillionth
degree
10 Longitude of
centralpoint
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
14 Radius DWORD Unit ismeter(m), routeistheturningpoint
tothenextturningpoint
18 Startingtime BCD[6] YY-MM-DD-hh-mm-ss,thisfieldisnull ifthe
0bitoftheareaattributeis0
24 Endingtime BCD[6] YY-MM-DD-hh-mm-ss,thisfieldisnull ifthe
0bitoftheareaattributeis0
30 Maximumspeed WORD Km/h,thisfieldisnull ifthe1bitofthearea
attributeis0
32 Over speed
duration
BYTE Unit is second(s) (similar expression inthe
area, samemodify as before), this field is
null ifthe1bitoftheareaattributeis0
Table58:Definitionofarea’sareaattribute
Bit Sign
0 1:Areatime
1 1:Speedlimit
2 1:Alerttodriverwhenenterthearea
3 1:Alerttotheplatformwhenenterthearea
4 1:Alerttodriverwhenexitthearea
5 1:Alerttotheplatformwhenexitthearea
6 0:Northlatitude;1:Southlatitude
7 0:Eastlongitude;1:Westlongitude
8 0:Opendoorsallowed;1:Opendoorsforbidden
9-13 Reserve
14 0:Opencommunicationmodulewhenenterthearea;1:Closecommunication
modulewhenenterthearea
15 0:NotcollectGNSSdetailedlocationdatawhenenterthearea;1:CollectGNSS
detailedlocationdatawhenenterthearea
41
8.36Deletecirclearea
MessageID:0x8601.
Deletecircleareamessagebodydataformatisshownintable59.
Table59:Deletecircleareamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Numberofareas BYTE Thenumberofareas inthismessage isno
more than 125. Multiple messages are
recommended ifmore than125. 0 stands
fordeleteallthecircleareas
1 AreaID1 DWORD
…… DWORD
AreaIDn DWORD
8.37Settingrectanglearea
MessageID:0x8602.
Settingrectangleareamessagebodydataformatisshownintable60.
Table60:Settingrectangleareamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Settingattribute BYTE 0:Upgradearea;
1:Appendarea;
2:Modifyarea
1 Total number of
areas
BYTE
2 Areaitem Rectangle area’s area itemdata format is
shownintable61
Table61:Rectanglearea’sareaitemdataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 AreaID DWORD
4 Areaattribute WORD Definitionofareaattributeisintable58
6 Latitudeoftopleft
point
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
10 Longitude of top
leftpoint
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
14 Latitudeofbottom
rightpoint
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
18 Longitude of
bottomrightpoint
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
22 Startingtime BCD[6] Sameasthetimerangesettingofcirclearea
28 Endingtime BCD[6] Sameasthetimerangesettingofcirclearea
42
34 Maximumspeed WORD Unit iskm/h, thisfieldisnull if the1bitof
areaattributeis0
36 Over speed
duration
BYTE Unitissecond(s),thisfieldisnull ifthe1bit
ofareaattributeis0
8.38Deleterectanglearea
MessageID:0x8603.
Deleterectangleareamessagebodydataformatisshownintable62.
Table62:Deleterectangleareamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Numberofareas BYTE Thenumberofareas inthismessage isno
more than 125. Multiple messages are
recommended ifmore than125. 0 stands
fordeleteallthecircleareas
1 AreaID1 DWORD
…… DWORD
AreaIDn DWORD
8.39Settingpolygonarea
MessageID:0x8604.
Settingpolygonareamessagebodydataformatisshownintable63.
Table63:Settingpolygonareamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 AreaID DWORD
4 Areaattribute WORD Definitionofareaattributeisintable58
6 Startingtime BCD[6] Sameasthetimerangesettingofcirclearea
12 Endingtime BCD[6] Sameasthetimerangesettingofcirclearea
18 Maximumspeed WORD Unit iskm/h, thisfieldisnull if the1bitof
areaattributeis0
20 Over speed
duration
BYTE Unitissecond(s),thisfieldisnull ifthe1bit
ofareaattributeis0
21 Total vertex
number of the
area
WORD
23 Vertexitem Vertex itemofpolygonareadataformat is
shownintable64
Table64:Vertexitemofpolygonareadataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Vertexlatitude DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
4 Vertexlongitude DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
43
degree
8.40Deletepolygonarea
MessageID:0x8605.
Deletepolygonareamessagebodydataformatisshownintable65.
Table65:Deletepolygonareamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Numberofareas BYTE Thenumberofareas inthismessage isno
more than 125. Multiple messages are
recommended ifmore than125. 0 stands
fordeleteallthecircleareas
1 AreaID1 DWORD
…… DWORD
AreaIDn DWORD
8.41Settingroute
MessageID:0x8606.
Settingroutemessagebodydataformatisshownintable66.
Table66:Settingroutemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 RouteID DWORD
4 Routeattribute WORD Route attribute data format is shown in
table67
6 Startingtime BCD[6] Sameasthetimerangesettingofcirclearea
12 Endingtime BCD[6] Sameasthetimerangesettingofcirclearea
18 Total number of
theroute’sturning
point
WORD
20 Turningpointitem Turningpoint itemof routedata format is
shownintable68
Table67:Routeattributedataformat
Bit Sign
0 1:Areatime
1 Reserve
2 1:Alerttodriverwhenentertheroute
3 1:Alerttotheplatformwhenentertheroute
4 1:Alerttodriverwhenexittheroute
5 1:Alerttotheplatformwhenexittheroute
6-15 Reserve
Table68:Turningpointitemofroutedataformat
Startingbyte Field Datatype Descriptionsandrequirements
44
0 TurningpointID DWORD
4 RouteID DWORD
8 Turning point
latitude
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
12 Turning point
longitude
DWORD Theunit of longitude isdegree, times the
sixthpowerof10,accuratetoonemillionth
degree
16 Widthoftheroute BYTE Unit ismeter(m), routeistheturningpoint
tothenextturningpoint
17 Routeattribute BYTE Routeattributedataformatisintable69
18 The threshold of
routedriving time
toolong
WORD Unitissecond(s),thisfieldisnull ifthe0bit
ofareaattributeis0
20 The threshold of
routedriving time
notenough
WORD Unitissecond(s),thisfieldisnull ifthe0bit
ofareaattributeis0
22 Maximum speed
oftheroute
WORD Unit iskm/h, thisfieldisnull if the1bitof
areaattributeis0
24 Over speed
duration of the
route
BYTE Unitissecond(s),thisfieldisnull ifthe1bit
ofareaattributeis0
Table69:Routeattributedataformat
Bit Sign
0 1:Drivingtime
1 1:Speedlimit
2 0:Southlatitude;1:Northlatitude
3 0:Eastlongitude;1:Westlongitude
4-7 Reserve
8.42Deleteroute
MessageID:0x8607.
Deleteroutemessagebodydataformatisshownintable70.
Table70:Deleteroutemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Numberofroute BYTE Thenumberof routes inthismessageisno
more than 125. Multiple messages are
recommended ifmore than125. 0 stands
fordeleteallthecircleroutes
1 RouteID1 DWORD
…… DWORD
RouteIDn DWORD
45
8.43Drivingrecorddatacollectcommand
MessageID:0x8700.
Drivingrecorddatacollectcommandmessagebodydataformatisshownintable71.
Table71:Drivingrecorddatacollectcommandmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Command BYTE Command list please see the relevant
requirementsinGB/T19056
1 Datablock Datablock content format please see the
relevant content inGB/T 19056, including
complete data packet required in GB/T
19056,canbenull
8.44Drivingrecorddataupload
MessageID:0x0700.
Drivingrecorddatauploadmessagebodydataformatisshownintable72.
Table72:Drivingrecorddatauploadmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Response serial
number
WORD Serial number in corresponding to the
driving record data collect command
message
2 Command BYTE Incorresponding tothecommandsent by
theplatform
3 Datablock Datablock content format please see the
relevant content inGB/T 19056, including
complete data packet required in GB/T
19056
8.45Drivingrecordparametersenddowncommand
MessageID:0x8701.
Drivingrecordparametersenddowncommandmessagebodydataformatisshownintable73.
Table73:Drivingrecordparametersenddowncommandmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Command BYTE Command list please see the relevant
requirementsinGB/T19056
1 Datablock Datablock content format please see the
relevant content inGB/T 19056, including
complete data packet required in GB/T
19056
8.46Electronicwaybillreport
MessageID:0x0701.
Electronicwaybillreportmessagebodydataformatisshownintable74.
Table74:Electronicwaybillreportmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
46
0 Length of
electronicwaybill
DWORD
4 Content of
electronicwaybill
Datapacketofelectronicwaybill
8.47Reportdriver’sidentityinformationrequest
MessageID:0x8702.
Reportdriver’sidentityinformationrequestmessagebodyisnull.
8.48Driver’sidentityinformationcollectsreport
MessageID:0x0702.
TheinstructionisautomaticallytriggeredaftertheoccupationalqualificationcertificateICcardof
theterminal isinsertedorpulledout.Usethisinstructiontoresponseafterreceivedthe0x8702
instruction.Driver’s identity informationcollectsreportmessagebodydataformat isshownin
table75.
Table75:Driver’sidentityinformationcollectsreportmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Status BYTE 0x01: The occupational qualification
certificateICcardinsert(driveronduty);
0x02: The occupational qualification
certificateICcardpulledout(driveroffduty)
1 Time BCD6[6] Time of insert/pull out IC card,
YY-MM-DD-hh-mm-ss; the following fields
arevalidandfilledonlywhenthestatus is
0x01
7 IC card reading
result
BYTE 0x00:ICcardreadingissuccessful;
0x01: Reading card failure, the reason is
cardkeyauthenticationfailed;
0x02:Readingcardfailure, thereasonisthe
cardislocked;
0x03:Readingcardfailure, thereasonisthe
cardhasbeenpulledout;
0x04: Reading card failure, the reason is
datavalidationerror.Thefollowingfieldsare
valid onlywhen IC card reading result is
0x00
8 Length of driver’s
name
BYTE n
9 Driver’sname STRING Nameofthedriver
9+n Occupational
qualification
certificatecode
STRING Length is 20bits, append0x00whennot
enough
29+n Length of license
issuing agency’s
BYTE m
47
name
30+n License issuing
agency’sname
STRING License issuing agency’s name of the
occupationalqualificationcertificate
30+n+m Validity of the
certificate
BCD[4] YYYYMMDD
8.49Positioningdatabatchupload
MessageID:0x0704.
Positioningdatabatchuploaddataformatisshownintable76.
Table76:Positioningdatabatchuploaddataformat
Startingbyte Field Datatype Illustration
0 Numbers of data
item
WORD Includingnumbers of location report data
item,>0
1 Type of location
data
BYTE 0: Normal location batch report; 1: Blind
areareport
2 Location report
dataitem
Definitionisshownintable77
Table77:Locationreportdataitemdataformat
Startingbyte Field Datatype Illustration
0 Lengthof location
reportdatabody
WORD Lengthoflocationreportdatabody,n
2 Location report
databody
BYTE[n] Definition is shown in 8.18 location
informationreport
8.50CANbusdatauploading
MessageID:0x0705.
CANbusdatauploadingdataformatisshownintable78.
Table78:CANbusdatauploadingdataformat
Startingbyte Field Datatype Illustration
0 Number of data
item
WORD Contained number of CAN bus data
items,>0
2 Reception time of
CANbusdata
BCD[5] CANbus data reception time of the first
data,hh-mm-ss-msms
8 CANbusdataitem Definitionisshownintable79
Table79:CANbusdataitemdataformat
Startingbyte Field Datatype Illustration
0 CANID BYTE[4] bit31 isCANchannel number, 0: CAN1, 1:
CAN2;
bit30 is theframetype, 0: Standardframe,
1:Extendedframe;
bit29isdatacollectway,0:Originaldata,1:
Theaverageofthecollectioninterval
48
bit28-bit0isCANbusID
4 CANDATA BYTE[8] CANdata
8.51Multimediaeventinformationuploading
MessageID:0x0800.
Multimediaeventinformationuploadingdataformatisshownintable80.
Table80:Multimediaeventinformationuploadingdataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Multimedia data
ID
DWORD >0
4 Multimediatype BYTE 0:Image;1:Audio;2:Video
5 Multimediaformat
code
BYTE 0: JPEG; 1: TIF; 2:MP3; 3:WAV; 4:WMV;
othersreserve
6 Eventitemcode BYTE 0: Platform sends down command; 1:
Timingaction; 2: Robberyalarmtriggered;
3:Collisionrolloveralarmtriggered;4:Door
openphotos;5:Doorclosephotos;6:Doors
fromopen toclose, speed from<20kmto
over20km;7:Fixeddistancephotos;
Othersreserve
7 ChannelID BYTE
8.52Multimediadataupload
MessageID:0x0801.
Multimediadatauploadmessagebodydataformatisshownintable81.
Table81:Multimediadatauploadmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 MultimediaID DWORD >0
4 Multimediatype BYTE 0:Image;1:Audio;2:Video
5 Multimediaformat
code
BYTE 0:JPEG;1:TIF;2:MP3;3:WAV;4:WMV;
othersreserve
6 Eventitemcode BYTE 0:Platformsenddowncommand;1:Timing
action; 2: Robbery alarm triggered; 3:
Collision rollover alarm triggered; others
reserve
7 ChannelID BYTE
8 Location
informationreport
(0x0200) message
body
BYTE[28] Represents the location basic information
dataofmultimediadata
36 Multimedia data
packet
49
8.53Multimediadatauploadresponse
MessageID:0x8800.
Multimediadatauploadresponsemessagebodydataformatisshownintable82.
Table82:Multimediadatauploadresponsemessagebodydataformat
Starting
byte
Field Datatype Descriptionsandrequirements
0 MultimediaID DWORD >0, no subsequent field if all packets are
received
4 Totalnumberof resend
packet
BYTE n
5 ResendpacketIDlist BYTE[2*n] Arrangedaccordingtotheserialnumberof
theresendpacket
8.54Cameraimmediatelytakencommand
MessageID:0x8801.
Cameraimmediatelytakencommandmessagebodydataformatisshownintable83.
Table83:Cameraimmediatelytakencommandmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 ChannelID BYTE >0
1 Takencommand WORD 0 for stop takingpictures; 0xFFFF for
record;othersfornumbersofphoto
3 Taken interval/recording
time
WORD Second, 0 stands for take photos at
minimumintervalsorrecording
5 Savingsign BYTE 1:Store;
0:Real-timeupload
6 Resolutiona BYTE 0x01:320*240;
0x02:640*480;
0x03:800*600;
0x04:1024*768;
0x05:176*144;[Qcif];
0x06:352*288;[Cif];
0x07:704*288;[HALFD1];
0x08:704*576;[D1]
7 Qualityofimage/video BYTE 1-10,1forminimumqualityloss,10for
maximumcompressionratio
8 Brightness BYTE 0-255
9 Contrast BYTE 0-127
10 Saturation BYTE 0-127
11 Chroma BYTE 0-255
aIftheterminaldoesnotsupporttheresolutionrequiredbythesystem,thenearestresolutionis
takenanduploaded.
8.55Cameraimmediatelytakencommandresponse
MessageID:0x0805.
50
Cameraimmediatelytakencommandresponsemessagebodydataformat isshownintable84.
Thiscommandisusedtorespondtothecameraimmediatelytakencommand0x8801sentbythe
monitoringcenter.
Table84:Cameraimmediatelytakencommandresponsemessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Responseserialnumber WORD Message serial number of the
corresponding platform camera
immediatelytakencommand
2 Result BYTE 0:Successful;1:Failure;2:Channelnot
support.
Thefollowingfieldsarevalidonlywhen
theresult=0
3 NumberofmultimediaID WORD n, the number of taken photo
successfulmultimedia
4 ListofmultimediaID BYTE[4*n]
8.56Retrieveofstoremultimediadata
MessageID:0x8802.
Retrieveofstoremultimediadatamessagebodydataformatisshownintable85.
Noted:Thestart/endtimeissetto00-00-00-00-00-00ifnotaccordingtothetimeinterval.
Table85:Retrieveofstoremultimediadatamessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Multimediatype BYTE 0:Image;1:Audio;2:Video
1 ChannelID BYTE 0standsforall channelof retrievethistypeof
media
2 Eventitemcode BYTE 0: Platformsend down command; 1: Timing
action;2:Robberyalarmtriggered;3:Collision
rolloveralarmtriggered;othersreserve
3 Startingtime BCD[6] YY-MM-DD-hh-mm-ss
9 Endingtime BCD[6] YY-MM-DD-hh-mm-ss
8.57Responseofstoremultimediadataretrieves
MessageID:0x0802.
Responseofstoremultimediadataretrievesmessagebodydataformatisshownintable86.
Table86:Responseofstoremultimediadataretrievesmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Responseserialnumber WORD Serial number of corresponding
multimediadataretrievemessage
2 Total item number of
multimediadata
WORD Total itemnumberofmultimediadata
thatmeettheretrievecondition
4 Retrieveitem Multimediaretrieveitemdataformatis
shownintable87
Table87:Multimediaretrieveitemdataformat
51
Startingbyte Field Datatype Descriptionsandrequirements
0 MultimediaID DWORD >0
4 Multimediatype BYTE 0:Image;1:Audio;2:Video
5 ChannelID BYTE
6 Eventitemcode BYTE 0: Platform send down command; 1:
Timingaction;2:Robberyalarmtriggered;
3:Collisionrolloveralarmtriggered;others
reserve
7 Location information
report (0x0200)
messagebody
BYTE[28] Represents the locationbasic information
dataof the initialmomentof shootingor
recording
8.58Storemultimediadatauploadcommand
MessageID:0x8803.
Storemultimediadatauploadcommandmessagebodydataformatisshownintable88.
Table88:Storemultimediadatauploadcommandmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Multimediatype BYTE 0:Image;1:Audio;2:Video
1 ChannelID BYTE
2 Eventitemcode BYTE 0: Platformsend down command; 1: Timing
action;2:Robberyalarmtriggered;3:Collision
rolloveralarmtriggered;othersreserve
3 Startingtime BCD[6] YY-MM-DD-hh-mm-ss
9 Endingtime BCD[6] YY-MM-DD-hh-mm-ss
15 Deletesign BYTE 0:Reserve;1:Delete
8.59Soundrecordstartcommand
MessageID:0x8804.
Soundrecordstartcommandmessagebodydataformatisshownintable89.
Table89:Soundrecordstartcommandmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Soundrecordcommand BYTE 0:Stopsoundrecord;0x01:Startsound
record
1 Soundrecordtime WORD Unit issecond(s),0issoundrecording
allthetime
3 Storesign BYTE 0:Real-timeupload;1:Store
4 Audiosamplingrate BYTE 0: 8K; 1: 11K; 2: 23K; 3: 32K; others
reserve
8.60Singlestoragemultimediadataretrievaluploadscommand
MessageID:0X8805.
Singlestoragemultimediadataretrievaluploadscommandmessagebodydataformat isshown
intable90.
Table90:Singlestoragemultimediadataretrievaluploadscommandmessagebodydata
52
format
Startingbyte Field Datatype Descriptionsandrequirements
0 MultimediaID DWORD >0
4 Deletesign BYTE 0:Reserve;1:Delete
8.61Datadownlinkpass-through
MessageID:0x8900.
Datadownlinkpass-throughmessagebodydataformatisshownintable91.
Table91:Datadownlinkpass-throughmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Pass-through message
type
BYTE Definition of pass-through message
typeisshownintable93
1 Pass-through message
content
8.62Datauplinkpass-through
MessageID:0x0900.
Datauplinkpass-throughmessagebodydataformatisshowntable92.
Table92:Datauplinkpass-throughmessagebodydataformat
Startingbyte Field Datatype Descriptionsandrequirements
0 Pass-through message
type
BYTE Definition of pass-through message
typeisshownintable93
1 Pass-through message
content
Table93:Definitionofpass-throughmessagetype
Pass-throughmessagetype Definition Descriptionsandrequirements
GNSS module detailed
locationdata
0x00 GNSSmoduledetailedlocationdata
Road transport certificate IC
cardinformation
0x0B Road transport certificate IC card information
uploadmessageis64bytes;senddownmessage
is24bytes.TheroadtransportcertificateICcard
authenticatesthepass-throughtimeoutperiodis
30s.Willnotresendaftertimeout.
Serialport1pass-through 0x41 Serialport1pass-throughmessage
Serialport2pass-through 0x42 Serialport2pass-throughmessage
User-definedpass-through 0xF0-0xFF User-definepass-throughmessage
8.63Datacompressionreport
MessageID:0x0901.
Datacompressionreportmessagebodydataformatisshownintable94.
Table94:Datacompressionreportmessagebodydataformat
Starting
byte
Field Data
type
Descriptionsandrequirements
0
4
Length of compression message
Compression message body
8.64 TheRSApublickeyofplatform
DWORD
Compression message body is message
that needs to be compressed through
the GZIP compression algorithm
Message ID: 0x8A00.
The RSA public key of platform message body data format is shown in table 95.
Table 95: The RSA public key of platform message body data format
Starting byte
Field
Data type
Descriptions and requirements
0
e
DWORD
e of {e, n} from platform RSA public key
4
n
BYTE[128]
n of {e, n} from platform RSA public key
8.65 TheRSApublickeyofterminal
Message ID: 0x0A00.
The RSA public key of terminal message body data format is shown in table 96.
Table 96: The RSA public key of terminal message body data format
Starting byte
Field
Data type
Descriptions and requirements
0
e
DWORD
e of {e, n} from terminal RSA public key
4
n
BYTE[128]
n of {e, n} from terminal RSA public key
53
AppendixA
(Normative appendix)
Communication protocol ofvehicle terminal and peripherals
A.1 Device
A.1.1 Host
Host should conform to J/T 794.
A.1.2 Slave machine
The slave machine includes a variety of point-to-point serial communication peripherals, such as
dispatching display screen, intelligent peripherals, oil measuring device, collision detection device,
etc.
A.2 Communicationprotocol
A.2.1 Definition of frame format
See table A.1 for the frame format for all communication between the host and slave machine.
Table A.1: Frame format
Identify
bit
Check
code
Version
number
Vendor
number
Peripherals
type number
Command
type
User
data
Identify
bit
1 byte
1 byte
2 byte
2 byte
Illustration of table A.1’s content is as follows:
1 byte
1 byte
n byte
1 byte
a) Identify bit: use 0x7e to express. It should be escaped if 0x7e appears in check code, header
and message body, the escape rules are defined as follows:
0x7e<----> 0x7d follows by a 0x02;
0x7d<----> 0x7d follows by a 0x01;
Escape process is as follows:
Whensending messages: message encapsulation--> calculate and fill the check code--> escape;
Whenreceiving messages: escape undo--> verify check code--> parse the message;
Example 1:
Send a data packet which content is 0x30 0x7e 0x08 0x7d 0x55, it’s encapsulated as follows: 0x7e
0x30 0x7d 0x02 0x08 0x7d 0x01 0x55 0x7e;
b) Check code: Take the lower 8 bits of cumulative sum from vendor number to user data as the
check code;
Example 2:
If the cumulative sum is 0x1388, the check code is 0x88
c) Version number: Identifies the version of communication protocol;
d) Vendor number: The manufacturer code of the peripheral slave machine;
e) Peripherals type number: Each peripheral has a unique type number. The peripheral interface
driver of host is used to distinguish data sent by what kind of peripheral. Peripherals type number
is shown in table A.2;
f) Command type: The information type of various data interaction between peripherals and host.
The command type is divided into general protocol and proprietary protocol: general protocol
mainly includes the basic, necessary and common types of information interaction between slave
54
55
machineandhost; proprietaryprotocol defines specific information interactiontypebetween
eachtypeofperipheralsandhost.CommandtypeisshownintableA.3;
g)Userdata:Referstothespecificbusinessfunctioncustomizedcontentof interactionbetween
peripheralsandhostexcepttheabove;
h)Thedataofthecommunicationframeisrepresentedbybig-endian.
TableA.2Peripheralstypenumber
Peripheralstype Number
Industryinformationterminal 0x01
Dispatchingdisplayscreen 0x02
Carnavigationdisplayscreen 0x03
Fuelcapacitydetector 0x04
Accelerationdetector 0x05
Burglaralarm 0x06
Interfaceexpander 0x07
Loaddetector 0x08
Passengerflowdetector 0x09
Generalsensor 0x0A
RoadtransportcertificateICcardreader 0x0B
Userdefined 0xF0-0xFF
TableA.3:Commandtype
Protocoltype Functiontype Commandtype
Peripherals
general
protocol
Poweronindication/response 0x01
Linkpolling/response 0x02
Slavemachinepowercontrol/response 0x03
Checktheslavemachineversionnumberinformation 0x04
Slavemachineself-check/response 0x05
Slavemachinefirmwareupdate/response 0x06
Reserve 0x07-0x3F
Proprietary
protocol
RoadtransportICcardcertificationrequest/response 0x40
RoadtransportICcardreadingresultnotice/response 0x41
Cardpulledoutnotice/response 0x42
InitiativetriggerICcardreading/response 0x43
Proprietary functional business protocols of various
peripheralsoftheslavemachine
0x44-0xFF
A.2.2Appendrulesofperipheralsprotocol
Appendandmodifyofperipheralsprotocolshouldfollows:
a)Protocolusethesamecommandtypeforthesamefunctiontosendandtorespond
b) Forperipherals thatwithmorecommandtypes,whenappendnewcommandtype, try to
minimizetheuseofcommandtypesbyusingvariableparameters.
56
A.3Definitionofgeneralprotocol
A.3.1Slavemachinepoweronindication
SlavemachinepoweronindicationisshownintableA.4.
TableA.4:Slavemachinepoweronindication
Process Commandtype Description Userdata Datadirection
1 01H Poweronindicationresponse Null Downlink
2 01H Poweronindication Null Uplink
A.3.2Peripheralslinkpolling
PeripheralslinkpollingcommandisshownintableA.5.
TableA.5:Peripheralslinkpollingcommand
Process Command
type
Description Userdata Data
direction
1 02H Linkpolling Linkmaintaintime
Thehigherbyteis inthefrontandthelower
byteis intherear;unitof thehigherbyteis
minute, lower byte is second; recommend
linkpollingtimeis15s-30s;afterlinktimeout,
thehostwill cancel the informationof slave
machine
Uplink
2 02H Link polling
response
Null Downlink
A.3.3Slavemachinepowercontrol
SlavemachinepowercontrolcommandisshownintableA.6.
TableA.6:Slavemachinepowercontrolcommand
Process Command
type
Description Userdata Data
direction
1 03H Slave machine
powercontrol
Control type: 0x00-- slavemachineexit
powersavingmode;0x01--slavemachine
enterpowersavingmode
Downlink
2 03H Slave machine
power control
response
Responsetype:0x01-- Uplink
A.3.4Checkversionnumberinformationofslavemachine
CheckversionnumberinformationofslavemachinecommandisshownintableA.7.
TableA.7:Checkversionnumberinformationofslavemachinecommand
Process Command
type
Description Userdata Data
direction
1 04H Check slavemachine
version number
information
Null Downlink
Check slavemachine Slave machine version number, Uplink
57
version number
informationresponse
WORD
e.g.:0x0207standsfor2.07version
A.3.5Slavemachineself-check
Slavemachineself-checkcommandisshownintableA.8
TableA.8:Slavemachineself-checkcommand
Process Command
type
Description Userdata Data
direction
1 05H Slave machine
self-check
Typeof self-checkslavemachine,BYTE,
accordingtothedefinitionintableA.2
Downlink
2 05H Result
information of
self-check
Typeof self-checkslavemachine,BYTE,
accordingtothedefinitionintableA.2
Uplink
Noted:Timeouttimeofthiscommandis1s,maximumresend3times ifnoresponse.Afterthe
terminalreceivestheself-checkfailure,setcorrespondingalarmsign,andvoicepromptorscreen
display.
A.3.6Slavemachinefirmwareupdate
SlavemachinefirmwareupdatecommandisshownintableA.9.
TableA.9:Slavemachinefirmwareupdatecommand
Process Command
type
Description Userdata Data
direction
1 06H Update slave
machine firmware
module
Totalpacketofmessage,WORD Downlink
PacketNo.,WORD,startfrom1
Packet data,maximumlength is 256
bytes
2 06H Confirm
information
PacketNo.,WORD Uplink
Responseresult,BYTE
0:Correct;
1: Not this firmware program, stop
upgrade;
2: Resend (after 3 times, terminate
thisupgrade)
Noted:Timeouttimeofthiscommandis1s,maximumresend3timesifnoresponse.
A.3.7Checkperipheralattribute
CheckperipheralattributecommandisshownintableA.10.
TableA.10:Checkperipheralattributecommand
Process Command
type
Description Userdata Data
direction
1 07H Check
peripheral
attribute
Null Downlink
2 07H Check Peripheralmanufacturernumber,5BYTE Uplink
58
peripheral
attribute
response
Peripheralhardwareversionnumber,3BYTE
Peripheralsoftwareversionnumber,3BYTE
Noted:Versionnumberexample,0x010B02standsforv1.12.2.
Timeouttimeofthiscommandis1s,maximumresend3timesifnoresponse.
A.4Definitionofproprietaryprotocol
A.4.1RoadtransportcertificateICcardauthenticationrequest
Whenacardisdetectedandthemoduleisresetorre-energizedaswellastheICcardnumberin
theslot is inconsistentwiththecardnumber read last time, themodulewill trigger theroad
transportcertificateICcardauthenticationrequestuplinkcommandautomatically.
RoadtransportcertificateICcardauthenticationrequestcommandisshownintableA.11.
TableA.11:RoadtransportcertificateICcardauthenticationrequestcommand
Process Command
type
Description Userdata Data
direction
1 40H ICcardauthentication
request
Statusbit,BYTE,
0x00:ICcardreadingsuccess;
0x01:ICcardnotinserted;
0x02:ICcardreadingfailure;
0x03: Not occupational
qualificationcertificateICcard
0x04:ICcardislocked
Uplink
Data zone (valid when status
bit=0x00), card basic information
and authenticate information (64
bytes)
2 40H ICcardauthentication
requestresponse
Result of IC card authentication
requestresponse,BYTE
0x00: Successfully complete the
authenticationrequest;
0x01:Theterminal isnotonline;
0x02: The terminal authenticate
centertimeoutwithnoresponse;
0x03: The terminal confirm
message is received(when ICcard
requestreadingresult=0x01-0x04)
Downlink
Datazone(validwhenresultof IC
card authentication request
response=0x00, IC card
authenticate request return check
datawhichis24bytes)
Noted:Timeouttimeis35swhenthiscommandisuplinkandstatusbitof ICcardauthenticate
request is0x00;timeouttimeis1swhenotherstatusanddownlink.Maximumresend3timesif
noresponse.
A. When status bit is 0x00, the terminal send 64 bytes’ card basic information and authentication
information to the authenticate center, and return result information of 1 or 25 byte to the
reading module according to different situation.
a. When the IC card authenticate request response result is 0x00 which returned by the terminal
to the reading module, reading module starts reading card information, and enable 41H
command feedback result to the terminal automatically. The terminal remind corresponding
result to the driver by voice prompt, and use 0x0702 command send driver’s identity information
to the authenticate center and monitoring platform after reading success;
b. When the IC card authenticate request response result is 0x01 which returned by the terminal
to the reading module, wait for 20 minutes, use 43H command trigger reading module to read IC
card automatically;
c. When the IC card authenticate request response result is 0x02 which returned by the terminal
to the reading module, the reading module resend 40H 3 times. After 3 unsuccessful attempts,
the terminal will end the process and remind corresponding result to the driver by voice prompt;
d. When the IC card authenticate request response result is 0x03 which returned by the terminal
to the reading module, end the process and the terminal remind corresponding result to the
driver by voice prompt.
B. End the process when terminal at status bit is not 0x00, and remind corresponding result to
the driver by voice prompt.
A.4.2 Road transport certificate IC card reading result notification
Road transport certificate IC card reading result notification command is shown in table A.12.
Table A.12: Road transport certificate IC card reading result notification command
Process
Command
type
Description
User data
Data
direction
1
41H
IC
card reading result
notification
IC reading result, BYTE
0x00:
IC
card
reading
success, and is followed by
subsequent data;
0x01: Card reading failed,
because
Uplink
of
card
key
authentication failed;
0x02: Card reading failed,
because the card is locked;
0x03: Card reading failed,
because the card has been
pulled out;
0x04: Card reading failed,
because of data check error
Data zone (valid when IC
card reading result is 0x00),
Driver’s identity information
is shown in A.13
2
41H
Driver’s identity information
received confirm
Null
Downlink
59
Noted: Timeout time of this command is 1s, maximum resend 3 times if no response.
A. The terminal use 0x0702 command send driver’s identity information to the authenticate
center and the corporation platform when received the IC card reading result is 0x00.
B. The terminal ends the process when received the IC card reading result is not 0x00. Remind
corresponding result to the driver by voice prompt.
Table A.13 Driver’s identity information
Starting
byte
Field
Data type
Descriptions and requirements
0
Length of the driver’s name
BYTE
Length is n
1
Driver’s name
STRING
Nameofthe driver
1+n
occupational
qualification
certificate number
STRING
Length is 20 bits
21+n
Length of issuing institution
name
BYTE
Length is n
22+n
Nameof issuing institution
STRING
Nameofcertificate issuing institution
22+n+m Validity of certificate
A.4.3 Card pulls out notification
BCD[4]
YYYYMMDD
Card pulls out notification command is shown in table A.14.
Table A.14: Card pulls out notification command format
Process
Command
type
Description
User data
Data direction
1
42H
Card pulls out notification
Null
Uplink
4
42H
Receive confirm of card pulls out
notification
Null
Downlink
Noted: Timeout time of this command is 1s, maximum resend 3 times if no response. The
terminal use 0x0702 command send driver off duty information to authenticate center and
monitoring platform when receive card pulls out notification.
A.4.4 Active trigger reading IC card
Active trigger reading IC card command is shown in table A.15.
Table A.15: Active trigger reading IC card command
Process
Command
type
Description
User data
Data direction
1
43H
Active trigger reading IC card
Null
Downlink
2
43H
Active trigger reading IC card
confirm information
Null
Uplink
Noted: Timeout time of this command is 1s, maximum resend 3 times if no response. This
command is used for terminal roll call, terminal not online or terminal upload IC card
authentication information timeout, etc. Reading module will trigger 40H command
automatically after receives this order.
60
61
AppendixB
(Normativeappendix)
Messagecollateformat
MessagecollateformatofterminalcommunicationprotocolisshownintableB.1.
TableB.1Messagecollate
No. Messagebodyname Message
ID
No. Messagebodyname Message
ID
1 Terminalgeneralresponse 0x01 35 Settingcirclearea 0x8600
2 Platformgeneralresponse 0x8001 36 Deletecirclearea 0x8601
3 Terminalheartbeat 0x0002 37 Settingrectanglearea 0x8602
4 Resendsub-packagerequest 0x8003 38 Deleterectanglearea 0x8603
5 Terminalregistration 0x0100 39 Settingpolygonarea 0x8604
6 Terminalregistrationresponse 0x8100 40 Deletepolygonarea 0x8605
7 Terminal logout 0x0003 41 Settingroute 0x8606
8 Terminalauthentication 0x0102 42 Deleteroute 0x8607
9 Terminalparametersetting 0x8103 43 Driving recorddatacollect
command
0x8700
10 Checkterminalparameter 0x8104 44 Drivingrecorddataupload 0x0700
11 Check terminal parameter
response
0x0104 45 Driving record parameter
senddowncommand
0x8701
12 Terminalcontrol 0x8105 46 Electronicwaybillreport 0x0701
13 Check specified terminal
parameters
0x8106 47 Driver’s identity
informationcollectsreport
0x0702
14 Checkterminalattribute 0x8107 48 Report driver’s identity
informationrequest
0x8702
15 Check terminal attribute
response
0x0107 49 Positioning data batch
upload
0x0704
16 Send down terminal update
packet
0x8108 50 CANbusdatauploading 0x0705
17 Notification of terminal
upgradesresults
0x0108 51 Multimedia event
informationuploading
0x0800
18 Locationinformationreport 0x0200 52 Multimediadataupload 0x0801
19 Locationinformationquery 0x8201 53 Multimedia data upload
response
0x8800
20 Location information query
response
0x0201 54 Camera immediately taken
command
0x8801
21 Temporary location tracking
control
0x8202 55 Camera immediately taken
commandresponse
0x0805
22 Manually confirm alarm
message
0x8203 56 Retrieve of store
multimediadata
0x8802
23 Senddowntextinformation 0x8300 57 Response of store
multimediadataretrieves
0x0802
24
Event setting
0x8301
58
25
Event report
0x0301
59
Store multimedia data
upload command
Sound
record
start
0x8803
0x8804
26
Question sends down
0x8302
60
command
Single storage multimedia
data
retrieval
uploads
0x8805
27
Question response
0x0302
61
command
Data
downlink
0x8900
28
Information on-demand menu
setting
Information
on-demand/cancels
Information service
0x8303
62
pass-through
Data uplink pass-through
0x0900
29
0x0303
63
Data compression report
0x0901
30
0x8304
64
31
Call back
0x8400
65
32
Phone book setting
0x8401
66
The RSA public key of
platform
The RSA public key of
terminal
Platform
downlink
0x8A00
0x0A00
33
Vehicle control
0x8500
67
message reserve
Platform uplink message
reserve
0x8F00~0
x8FFF
0x0F00~0
x0FFF
34
Vehicle control response
0x0500
62