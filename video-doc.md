JTT 1078-2016 (En)
MettaX
Table of Contents
JTT 1078-2016 (En)
Table of Contents
Foreword
Video Communication Protocol for Satellite Positioning System of Road Transport Vehicles
1 Scope
2 Normative references
3 Terms and definitions, abbreviations
3. 1 Terms and Definitions
3. 1. 1
3. 1. 2
3. 2 Abbreviations
4 Protocol basis between video terminal and video platform
4. 1. Basic stipulations of the agreement
4. 2. Real-time audio and video transmission channel agreement
4. 3 Classification of audio and video communication packets
5 Communication protocol between video terminal and video platform
5. 1 Protocol instruction set
5. 2 Inheritance command
5. 3 Parameter setting instructions
5. 3. 1 Terminal audio and video parameter settings
5. 3. 2 Query the audio and video properties of the terminal
5. 3. 3 Terminal upload audio and video attributes
5. 4 Video alarm command
5. 4. 1 Video alarm reporting
5. 4. 2 Terminal upload passenger flow
5. 5. Real-time audio and video transmission instructions
5. 5. 1 Real-time audio and video transmission request
5. 5. 2 Audio and video real-time transmission control
5. 5. 3 Real-time audio and video streaming and transparent data transmission
5. 5. 4 Real-time audio and video transmission status notification
5. 6 Historical audio and video query, playback and download commands
5. 6. 1 Query resource list
5. 6. 2 Terminal upload audio and video resource list
5. 6. 3 The platform sends a remote video playback request
5. 6. 4 The platform issues remote video playback control
5. 6. 5 File upload command
5. 6. 6 Notification of file upload completion
5. 6. 7 File upload control
5. 7 PTZ control command
5. 7. 1 PTZ rotation
5. 7. 2 PTZ adjustment focus control
5. 7. 3 PTZ adjustment aperture control
5. 7. 4 PTZ wiper control
5. 7. 5 Infrared fill light control
5. 7. 6 PTZ zoom control
5. 8 Terminal sleep wake-up command
6 Code stream communication between audio and video stream server and client player softwareiMettaX.com
6. 1 Audio and video stream and transparent data encapsulation format
6. 2 Audio and video stream request URL instruction format
7 Communication protocol basis between video platforms
8 Communication protocol flow between video platforms
8. 1 Time-limited password report and request business class
8. 2 Real-time audio and video services
8. 2. 1 The enterprise video monitoring platform uploads audio and video data to the
government video monitoring platform in real time
8. 2. 2 Enterprise video surveillance platforms stop uploading audio and video data to
government video surveillance platforms in real time
8. 3 Remote Video Retrieval Service
8. 3. 1 The government video monitoring platform obtains the audio and video resource catalog
from the enterprise video monitoring platform
8. 3. 2 The enterprise video monitoring platform actively uploads the audio and video resource
catalog to the government video monitoring platform
8. 4 Remote video download business
8. 4. 1 The government video monitoring platform downloads video data to the enterprise
video monitoring platform
8. 4. 2 The enterprise video monitoring platform sends a download completion notification to
the government video monitoring platform
8. 4. 3 The government video monitoring platform sends download control instructions to the
enterprise video monitoring platform
8. 5 Remote video playback business
8. 5. 1. The government video monitoring platform requests video playback from the enterprise
video monitoring platform
8. 5. 2 The government video monitoring platform stops requesting video playback from the
enterprise video monitoring platform
9 Definition of communication protocol constants between video platforms
9. 1 Service data type identification
9. 2 Identification of sub-service types
9. 3 Video alarm type coding
Appendix A
Foreword
This standard is in accordance with GB/T 1.1-2009 given the drafting of the rules.
This standard is proposed and managed by the Transportation Information Communication and
Navigation Standardization Technical Committee.
Video Communication Protocol for
Satellite Positioning System of Road
Transport Vehicles
1 ScopeiMettaX.com
This standard specifies the protocol basis and communication protocol between the vehicle-
mounted video terminal and the video platform in the satellite positioning system for road
transport vehicles, the code stream communication between the audio and video stream server
and the client playback software, and the communication protocol basis between video
platforms,communication protocol flow, constant definition and protocol data body format.
This standard applies to the transmission of audio and video data between the on-board video
terminal of the satellite positioning system of road transport vehicles and the enterprise video
monitoring platform and exchange and share audio and video resources between different video
platforms.
2 Normative references
The following documents are indispensable for the application of this document. For dated
references, only the dated version applies to this document. For undated reference documents,
the latest version (including all amendments) applies to this document.
JT/T 808-2011 Communication protocol and data format of satellite positioning system terminal
for road transport vehicles
JT/T 809-2011 Data exchange of satellite positioning system platform for road transport vehicles
JT/T 1076-2016 Technical requirements for on-board video terminals of satellite positioning
system for road transport vehicles
JT/T 415-2006 Road transport e-government platform catalog coding rules
IETF RFC 3550 RTP Real-time Transport Protocol (Real-time Transport Protocol)
IETF RFC 2854 Text/Hypertext markup language multimedia type (The Text/Html Media Type)
3 Terms and definitions, abbreviations
3. 1 Terms and Definitions
The following terms and definitions apply to this document.
3. 1. 1
Code rate: data bits transmitted per unit of time during data transmission, and the common unit
is kilobits per second (kbps).
3. 1. 2
Frame rate: the number of updates per second when the graphics processor processes the field,
and is used to measure the number of display frames. The measurement unit is the number of
display frames per second (Frame per Second, FPS).
3. 2 Abbreviations
The following abbreviations apply to this document.
AAC: Advanced Audio Coding
MPEG: Moving Pictures Experts Group
RTP: Real-time Transport Protocol
TCP: Transmission Control ProtocoliMettaX.com
UDP: User Datagram Protocol
URL: Uniform Resource Locator
UTF-8: 8-bit Unicode Transformation Format
FTP: File Transfer Protocol
4 Protocol basis between video terminal and video
platform
4. 1. Basic stipulations of the agreement
The communication method, data type, transmission rules and message composition of the
protocol are in accordance with the requirements of Chapter 4 of JT/T 808-2011.
The communication connection mode of the signaling data message in the protocol is in
accordance with the requirements of Chapter 5 of JT/T 808-2011.
The message processing mechanism of the signaling data message in the protocol is in
accordance with the requirements of Chapter 6 of JT/T 808-2011.
The encryption mechanism of the signaling data message in the protocol is in accordance with the
requirements of Chapter 7 of JT/T 808-2011.
In the agreement, the communication parties between the platform and the terminal shall meet
the following requirements:
—— Unless expressly agreed, all messages shall be responded;
—— If the dedicated response message is not clearly specified, a general response shall be used
to reply;
—— For messages with sub-packages, the responder shall respond to each sub-packet message
one by one.
4. 2. Real-time audio and video transmission channel
agreement
One channel of real-time audio and video transmission can transmit one channel of video
information or one channel of audio information, and can also transmit one channel of video
information and one channel of audio frequency information. There are two types of real-time
audio and video transmission channel conventions:
——When the TCP is used, each TCP connection can carry multiple audio and video channels. If
there is no data within the set timeout,, both the terminal and the monitoring center can actively
close the TCP connection used for audio and video data transmission.
——When the UDP is used, each UDP port can carry multiple audio and video channels.iMettaX.com
4. 3 Classification of audio and video communication packets
Audio and video data packets are divided into the following two categories:
——Signaling data packets: the data format should comply with the provisions of JT/T 808-2011,
and add new protocol instructions and data formats on the basis of its protocol format. The
communication should use the established link between the vehicle video terminal and the
enterprise video surveillance platform for transmission of positioning information, and no new
link should be created.
—— Bit stream data message: used for network real-time audio and video transmission, network
video playback, voice dialogue, voice monitoring, voice broadcasting, etc. A new link should be
created instead of the link for transmitting positioning information.
5 Communication protocol between video terminal
and video platform
5. 1 Protocol instruction set
See Appendix A for the comparison table of instruction messages between video terminals and
video platforms.
5. 2 Inheritance command
Inherit and use other commands in JT/T 808-2011 except the message ID 0x8804 (recording start
command). In addition, in JT/T 808-2011 there are 0x0800 (multimedia event message upload),
0x0801
(multimedia data upload), 0x8802 (stored multimedia data retrieval), 0x0802 (stored multimedia
data retrieval response), and 0x8803 (stored multimedia data upload). The multimedia type field
in
the 5 instructions above shall be in accordance with 5. 4 and 5. 5 requirements in this standard
for the image, audio and video type data transmission.
5. 3 Parameter setting instructions
5. 3. 1 Terminal audio and video parameter settings
The terminal audio and video parameter setting message adopts 0x8103 message defined in JT/T
808-2011 8. 8 , and add the following audio and video parameters settings, see Table 1.
Table 1 Audio and video setting parameter tableiMettaX.com
parameter type of
data Description and requirements
0x0075 Audio and video parameter settings, see Table 2 for description
0x0076 Audio and video channel list settings, see Table 3 for description
0x0077 Individual video channel parameter settings, see Table 5 for
description
0x0079 Special alarm recording parameter setting, description see Table
7
0x007A DWORD
Video-related alarm masking words, and corresponding to the
definition of the alarm flag bit in Table 13; if the corresponding
bit is 1, the corresponding Types of alarms are masked
0x007B Image analysis alarm parameter setting, description is shown in
Table 8
0x007C Terminal sleep wake-up mode setting, description see Table 9
Table 2 Definition and description of audio and video parametersiMettaX.com
start
byte field type of
data Description and requirements
0 live stream encoding
mode BYTE
0: CBR (constant bit rate);
1: VBR (variable bit rate);
2: ABR (average bit rate);
100 ~ 127: Customized
1 Live Streaming
Resolution BYTE
0: QCIF;
1: CIF;
2: WCIF;
3: D1;
4: WD1;
5: 720P;
6: 1080P;
100 ~ 127: Customized
2 Live Stream Keyframe
Interval WORD Range (1 ~ 1 000) frames
4 Live Stream Target
Frame Rate BYTE Range (1 ~ 120) frame/s
5 Real-time streaming
target bit rate DWORD The unit is kilobits per second (kbps)
9 Save Stream Encoding
Mode BYTE
0: CBR (constant bit rate);
1: VBR (variable bit rate);
2: ABR (average bit rate);
100 ~ 127: Customized
10 Save Stream
Resolution BYTE
0: QCIF;
1: CIF;
2: WCIF;
3: D1;
4: WD1;
5: 720P;
6:1 080P;
100 ~ 127: Custom
11 Save Stream Keyframe
Interval WORD Range (1 ~ 1000) frames
13 Save Stream Target
Frame Rate BYTE Range (1 ~ 120) frame/s
14 Storage stream target
bit rate DWORD The unit is kilobits per second (kbps)iMettaX.com
start
byte field type of
data Description and requirements
18 OSD subtitle overlay
settings WORD
Set by bit: 0 means not superimposed, 1
means superimposed;
bit0: date and time;
bit1: license plate number;
bit2: logical channel number;
bit3: latitude and longitude;
bit4: driving record speed;
bit5: satellite positioning speed; bit6:
continuous driving time;
bit7 ~ bit10: Reserved;
bit11 ~ bit15: Customized
20 Whether to enable
audio output BYTE 0: disable; 1: enable
start
byte field type of
data
Description and
requirements
0 Total number of audio and video
channels BYTE expressed by l
1 Total number of audio channels BYTE expressed by m
2 Total number of video channels BYTE expressed by n
3 Audio and video channel
comparison table
BYTE
[4 × (l + m
+ n)]
See Table 4
start
byte field type of
data Description and requirements
0 physical channel number BYTE start from 1
1 logical channel number BYTE According to Table 2 in JT/T 1076-2016
2 channel type BYTE
0: audio and video;
1: Audio;
2: Video
3 Whether to connect to
the gimbal BYTE
This field is valid when the channel
type is 0 and 2;
0: not connected; 1: connected
Table 3 List of audio and video channels
Table 4 Audio and video channel comparison tableiMettaX.com
start
byte field type of
data
Description and
requirements
0 Number of channels whose video parameters
need to be set separately BYTE expressed by n
1 Single channel video parameter setting list BYTE[21
× n] See Table 6
Table 5 Definition and description of individual channel video parameters
Table 6 Individual channel video parameter settingsiMettaX.com
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-2016
1 live stream encoding
mode BYTE
0: CBR (constant bit rate);
1: VBR (variable bit rate);
2: ABR (average bit rate);
100 ~ 127: Custom
2 Live Streaming
Resolution BYTE
0: QCIF;
1: CIF;
2: WCIF;
3: D1;
4: WD1;
5: 720P;
6:1 080P;
100 ~ 127: Custom
3 Live Stream Keyframe
Interval WORD Range (1 ~ 1 000) frames
5 Live Stream Target
Frame Rate BYTE Range (1 ~ 120) frame/s
6 Real-time streaming
target bit rate DWORD The unit is kilobits per second (kbps)
10 Save Stream Encoding
Mode BYTE
0: CBR (constant bit rate);
1: VBR (variable bit rate);
2: ABR (average bit rate);
100 ~ 127: Customized
11 Save Stream
Resolution BYTE
0: QCIF;
1: CIF;
2: WCIF;
3: D1;
4: WD1;
5: 720P;
6:1 080P;
100 ~ 127: Customized
12 Save Stream Keyframe
Interval WORD Range (1 ~ 1 000) frames
14 Save Stream Target
Frame Rate BYTE Range (1 ~ 120) frame/s
15 Storage stream target
bit rate DW ORD The unit is kilobits per second (kbps)iMettaX.com
start
byte field type of
data Description and requirements
19 OSD Overlay Settings WORD
Set by bit: 0 means not superimposed, 1
means superimposed;
bit0: date and time;
bit1: license plate number;
bit2: logical channel number;
bit3: latitude and longitude;
bit4: driving record speed;
bit5: satellite positioning speed;
bit6: continuous driving time;
bit7 ~ bit10: Reserved;
bit11 ~ bit15: Customized
start
byte field
type
of
data
Description and requirements
0
Special alarm
recording storage
threshold
BYTE
Special alarm recording takes up main memory
storage threshold %, ranges from 1 to 99, default
value is 20
1
Special alarm
recording
duration
BYTE The maximum duration of special alarm recording,
the unit is minutes (min), the default value is 5
2 Special alarm flag
start time BYTE
The recording time marked before the special
alarm occurs, The unit is minutes (min), the default
value is 1
start
byte field
type
of
data
Description and requirements
0
Approved number of
passengers in the
vehicle
BYTE trigger an alarm when video analysis results
exceeded the approved passengers
1 fatigue threshold BYTE trigger an alarm when video analysis results
exceeded the fatigue threshold
Table 7 Definition and description of special alarm recording parameters
Table 8 Definition and description of video analysis alarm parameters
Table 9 Terminal sleep wake-up mode setting data formatiMettaX.com
start
byte field type of
data Description and requirements
0 sleep wake mode BYTE
Set by bit: 0 means not set, 1 means set;
bit0: conditional wake-up;
bit1: Timing wake-up;
bit2: manual wake-up
1 Wake up condition
type BYTE
When bit0 is 1 in sleep wake-up mode, this
field is effective, otherwise set to 0;
Set by bit: 0 means not set, 1 means set;
bit0: emergency alarm;
bit1: Collision and rollover alarm;
bit2: vehicle door open
2 Timed wake-up
day setting BYTE
Set by bit: 0 means not set, 1 means set;
bit0: Monday;
bit1: Tuesday;
bit2: Wednesday;
bit3: Thursday;
bit4: Friday;
bit5: Saturday;
bit6: Sunday
3 List of daily wake-
up parameters BYTE[17] See Table 10, each time period should not
overlap
Table 10 Day wake-up parameter definitioniMettaX.com
start
byte field type of
data Description and requirements
0 Timing wakeup enable
flag BYTE
Set by bit: 0 means not set, 1 means
set;
bit0: Time period 1 wake-up time
enabled;
bit1: Time period 2 wake-up time
enabled;
bit2: Time period 3 wake-up time
enabled;
bit3: time period 4 wake-up time
enable
1 Time Zone 1 Wake Up
Time BCD[2] HHMM, value range 00:00 ~ 23:59
3 Time Period 1 Closing
Time BCD[2] HHMM, value range 00:00 ~ 23:59
5 Time Period 2 Wake Up
Time BCD[2] HHMM, value range 00:00 ~ 23:59
7 Time Period 2 Closing
Time BCD[2] HHMM, value range 00:00 ~ 23:59
9 Time Period 3 Wake Up
Time BCD[2] HHMM, value range 00:00 ~ 23:59
11 Time Period 3 Closing
Time BCD[2] HHMM, value range 00:00 ~ 23:59
13 Time Period 4 Wake Up
Time BCD[2] HHMM, value range 00:00 ~ 23:59
15 Time Period 4 Closing
Time BCD[2] HHMM, value range 00:00 ~ 23:59
5. 3. 2 Query the audio and video properties of the terminal
Message ID: 0x9003.
The message body is empty.
5. 3. 3 Terminal upload audio and video attributes
Message ID: 0x1003.
Message type: signaling data message.
Use the terminal upload audio and video attribute command to respond to the query terminal
audio and video attribute message issued by the platform. The message body data format is
shown in Table 11.iMettaX.com
start
byte field
type
of
data
Description and
requirements
0 Input audio encoding method BYTE See Table 12
1 Enter the number of audio channels BYTE
2 Input audio sample rate BYTE
0: 8kHz;
1:22. 05 kHz;
2:44. 1 kHz;
3: 48kHz
3 Input Audio Sample Bits BYTE
0: 8 bits;
1: 16 bits;
2: 32 bits
4 audio frame length WORD Range 1 to 4 294
967 295
6 Whether to support audio output BYTE 0: Not supported; 1:
Supported
7 Video encoding method BYTE See Table 19
8 The maximum audio physical channel quantity
supported by the terminal BYTE
9 The maximum video physical channel quantity
supported by the terminal BYTE
Table 11 Terminal upload audio and video attribute data format
Table 12 Definition table of audio and video coding typesiMettaX.com
coding name notes
0 reserve
1 G.721 audio
2 G.722 audio
3 G.723 audio
4 G.728 audio
5 G.729 audio
6 G.711A audio
7 G.711U audio
8 G.726 audio
9 G.729A audio
10 DVI4_3 audio
11 DVI4_4 audio
12 DVI4_8K audio
13 DVI4_16K audio
14 LPC audio
15 S16BE_STEREO audio
16 S16BE_MONO audio
17 MPEGAUDIO audio
18 LPCM audio
19 AAC audio
20 WMA9STD audio
21 HEAAC audio
22 PCM_VOICE audio
23 PCM_AUDIO audio
24 AACLC audio
25 MP3 audio
26 ADPCMA audio
27 MP4AUDIO audio
28 AMR audio
29 ~ 90 reservediMettaX.com
coding name notes
91 Transparent transmission system
92 ~ 97 reserved video
98 H.264 video
99 H.265 video
100 AVS video
101 SVAC video
102 ~ 110 reserved
111 ~ 127 customized
5. 4 Video alarm command
5. 4. 1 Video alarm reporting
The video alarm report adopts the method of reporting the position information at the same
time, as the additional information of the 0x0200 position information report, and the additional
information of the JT/T808-2011 Table 20 is expanded. The extended definition of additional
information is shown in Table 13.
Table 13 Additional information definition table extensioniMettaX.com
Additional
Information
ID
Additional
information
length
Description and requirements
0x14 4 Video-related alarm, DWORD, set by bit, the definition of
the flag bit is shown in Table 14
0x15 4
Video signal loss alarm state, DWORD, set by bit, bit0 ~
bit31 respectively represent the first 1 to 32 logical
channels, if the corresponding bit is 1, it means that the
video signal loss occurs in this logical channel
0x16 4
Video signal masking alarm status, DWORD, set by bit, bit0
~ bit31 respectively represent the first 1 to 32 logical
channels, if the corresponding bit is 1, it means that the
video signal of the logical channel is blocked
0x17 2
Memory failure alarm status, WORD, set by bit, bit0 ~
bit11 respectively represent the 1st ~ 12th main
memories, bit12~bit15 represent the 1st~4th disaster
recovery storage devices respectively, and if the
corresponding bits is 1, it means that the memory has
failed
0x18 2 Detailed description of abnormal driving behavior alarm,
WORD, see Table 15 for definitions
Table 14 Definition of video alarm flag bitsiMettaX.com
bit definition Handling instructions
0 Video signal loss alarm The flag is maintained until the alarm
condition is removed
1 Video signal blocking alarm The flag is maintained until the alarm
condition is removed
2 Storage unit failure alarm The flag is maintained until the alarm
condition is removed
3 Other video equipment failure alarm The flag is maintained until the alarm
condition is removed
4 Bus overcrowding alarm The flag is maintained until the alarm
condition is removed
5 Abnormal driving behavior alarm The flag is maintained until the alarm
condition is removed
6 The special alarm for recording reaches
the storage threshold
the alarm is cleared after receiving the
response
7
~
31
reserved
start
byte field
type
of
data
Description and requirements
0
Types of
abnormal driving
behavior
WORD
Set by bit: 0 means no, 1 means yes;
bit0: fatigue;
bit1: call;
bit2: smoking;
bit3 ~ bit10: Reserved;
bit11 ~ bit15: Custom
2 Fatigue BYTE The degree of fatigue is expressed on a scale of 0
to 100, with higher value indicates more fatigue
Table 15 Definition of abnormal driving behavior flags
5. 4. 2 Terminal upload passenger flow
Message ID: 0x1005.
Message type: signaling data message.
The terminal device counts passengers getting on and off the bus through video analysis, and
sends the counting results to the platform. The message body data format is shown in Table 16.iMettaX.com
start
byte field
type
of
data
Description and requirements
0 Start time BCD[6]
YY-M-M-DD-HH-MM-SS (GMT+8 time, All
subsequent times in the standard use this time
zone)
6 End Time BCD[6] YY-MM-DD-HH-MM-SS
12
Number of
people on
board
WORD Number of boarders from start time to end time
14
Number of
people getting
off
WORD The number of people getting off from the start
time to the end time
Table 16 Terminal upload passenger flow data format
5. 5. Real-time audio and video transmission instructions
5. 5. 1 Real-time audio and video transmission request
Message ID: 0x9101.
Message type: signaling data message.
The platform requests real-time audio and video transmission from the terminal equipment,
including real-time video transmission, actively initiating two-way voice intercom, one-way
monitoring, and sending broadcast voice and specific transparent transmission, etc. The message
body data format is shown in Table 17. After receiving this message, the terminal replies to the
video terminal general answer, and then establish a transmission link through the corresponding
server IP address and port number, and then transmit the corresponding audio and video data
according to the audio and video stream transmission protocol.
Table 17 Real-time audio and video transmission request data formatiMettaX.com
start
byte field type of
data Description and requirements
0 Server IP address
length BYTE length n
1 server IP address STRING
1 + n
Server video channel
monitoring port
number (TCP)
WORD Live video server IP address
3 + n
Server video channel
monitoring port
number (UDP)
WORD Real-time video server TCP port number
5 + n logical channel
number BYTE Real-time video server UDP port number
6 + n type of data BYTE According to Table 2 in JT/T 1076-2016
7 + n stream type BYTE
0: audio and video, 1: video, 2: two-way
intercom, 3: monitoring, 4: Central
broadcasting, 5: Transparent transmission
After the platform receives a special alarm from the video terminal, it should issue this command
without waiting for manual confirmation to start real-time audio and video transmission.
5. 5. 2 Audio and video real-time transmission control
Message ID: 0x9102.
Message type: signaling data message.
The platform sends audio and video real-time transmission control commands, which are used to
switch code streams, pause code stream transmission, close audio and video transmission
channels, etc.. The data format of the message body is shown in Table 18.
Table 18 Audio and video real-time transmission control data formatiMettaX.com
start
byte field
type
of
data
Description and requirements
0
logical
channel
number
BYTE According to Table 2 in JT/T 1076-2016
1 Control
instruction BYTE
The platform can use this command to control the real-
time audio and video of the device:
0: Close the audio and video transmission command;
1: Switch code stream (add pause and continue);
2: Suspend the sending of all streams of this channel;
3: Resume the sending of the flow before the suspension,
and the flow type before the suspension consistent type;
4: Close the two-way intercom
2
Close
audio and
video type
BYTE
0: Close the audio and video data related to this channel;
1: Only close the audio related to this channel, keep this
channel related video;
2: Only close the video related to this channel, keep this
channel related audio
3
Switch
stream
type
BYTE
Switch the previously applied code stream to the newly
applied code stream, audio remains the same as it was
before the switch.
The code stream for the new application is:
0: main stream;
1: sub stream
5. 5. 3 Real-time audio and video streaming and transparent data
transmission
Message type: code stream data message.
The transmission of real-time audio and video stream data refers to the RTP protocol, which is
carried by UDP or TCP. The payload packet format is specified in IETF RFC 3550 On the basis of
the definition of RTP, fields such as message serial number, SIM card number, audio and video
channel number are supplemented, and the definition of the payload packet format is shown in
Table 19.
The bits defined in the table are filled in the big-endian mode.
Table 19 Definition table of payload packet format of audio and video stream and transparent
data transmission protocoliMettaX.com
start
byte field type of
data Description and requirements
0
Frame
header
identification
DWORD Fixed to 0x30 0x31 0x63 0x64
4 V 2 BITS Fixed to 2
P 1 BIT Fixed to 0
X 1 BIT Whether the RTP header needs an extension bit,
fixed to 0
CC 4 BITS Fixed to 1
5 M 1 BIT Flag bit to determine if it is the boundary of a
complete data frame
PT 7 BITS load type, see table 19
6
package
serial
number
WORD Initially 0, each time an RTP packet is sent, the
sequence number plus 1
8 SIM card
number BCD[6] Terminal SIM card number
14
logical
channel
number
BYTE According to Table 2 in JT/T 1076-2016
15 type of data 4 BITS
0000: Video I frame;
0001: Video P frame;
0010: Video B frame;
0011: audio frame;
0100: Transparently transmit data
subcontract
processing
flag
4 BITS
0000: atomic package, cannot be split;
0001: the first packet in subpackage processing;
0010: The last packet in subpackage processing;
0011: Intermediate package during subcontract
processing
16 timestamp BYTE[8]
Identifies the relative time of the current frame of
this RTP packet, single Bit milliseconds (ms). When
the data type is 0100, there is no this field
24 Last I Frame
Interval WORD
The time interval between this frame and the
previous keyframe, single Bit milliseconds (ms), when
the data type is non-video frame, then no this field
26 Last Frame
Interval WORD
The time interval between this frame and the
previous frame, in milliseconds (ms), when the data
type is not video frame, there is no this fieldiMettaX.com
start
byte field type of
data Description and requirements
28 data body
length WORD Subsequent data body length, excluding this field
30 data body BYTE[n] Audio and video data or transparent transmission
data, the length should not exceed 950 bytes
start
byte field
type
of
data
Description and requirements
0
logical
channel
number
BYTE According to Table 2 in JT/T 1076-2016
1 Packet
loss rate BYTE
The packet loss rate of the current transmission channel,
the value multiplied by 100 and then truncate the integer
part.
5. 5. 4 Real-time audio and video transmission status notification
Message ID: 0x9105.
Message type: signaling data message.
The platform sends a notification packet to the terminal according to the set time interval during
the process of receiving the audio and video data uploaded by the terminal, and the message
body data format
is in Table 20.
Table 20 Real-time audio and video transmission status notification data format
5. 6 Historical audio and video query, playback and
download commands
5. 6. 1 Query resource list
Message ID: 0x9205.
Message type: signaling data message.
The platform queries the video file list from the terminal according to the combined conditions
such as audio and video type, channel number, alarm type, and start and end time.
The data format is shown in Table 21.iMettaX.com
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-2016, 0
means all channels
1 Starting time BCD[6] YY-MM-DD-HH-MM-SS, all 0 means no start
time condition
7 End Time BCD[6] YY-MM-DD-HH-MM-SS, all 0 means no end
time condition
13 alarm flag 64 BITS
bit0 ~ bit31: see JT/T 808-2011 Table 18
Alarm flag definition;
See Table 13 for bit32 ~ bit63;
All 0 means no alarm type condition
21 Audio and video
resource type BYTE 0: audio and video, 1: audio, 2: video, 3:
video or audio&video
22 stream type BYTE 0: All streams, 1: Main stream, 2: Sub
stream
23 memory type BYTE 0: All storage, 1: Main storage, 2: Disaster
recovery storage
start
byte field type of
data Description and requirements
0 serial number WORD Corresponding to the serial number of the query
audio and video resource list command
2 Total audio and
video resources DWORD If there is no audio and video resource that
meets the conditions, set it to 0
6 List of audio and
video resources See Table 23
Table 21 Query video file list data format
5. 6. 2 Terminal upload audio and video resource list
Message ID: 0x1205.
Message type: signaling data message.
The terminal responds to the platform's command to query the audio and video resource list, and
responds with the terminal uploading the audio and video resource list message. If the list is too
large to subcontract transmission, use the subcontracting mechanism defined in JT/T 808-2011 4.
4. 3 to process, the platform should reply a general response for each individual subcontracting.
The message body data format is shown in Table 22.
Table 22 Data format of terminal uploaded audio and video resource listiMettaX.com
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-2016
1 Starting time BCD[6] YY-MM-DD-HH-MM-SS
7 End Time BCD[6] YY-MM-DD-HH-MM-SS
13 alarm flag 64BITS bit0 ~ bit31 according to Table 18 of JT/T 808-2011
Alarm flag definition; bit32 ~ bit63 see Table 13
21
Audio and
video resource
type
BYTE 0: audio and video, 1: audio, 2: video
22 stream type BYTE 1: main stream, 2: sub stream
23 memory type BYTE 1: main memory, 2: disaster recovery memory
24 File size DWORD Unit byte (BYTE)
Table 23 The format of the list of audio and video resources uploaded by the terminal
5. 6. 3 The platform sends a remote video playback request
Message ID: 0x9201.
Message type: signaling data message.
The platform requests audio and video recording playback from the terminal device, and the
terminal should respond with the command 0x1205 (upload the list of video files by the terminal),
and then the transmission video data adopts the real-time audio and video stream data
transmission RTP protocol payload packet format defined in Table 18. See Table 24 for the data
format.
Table 24 Data format of remote video playback request issued by the platformiMettaX.com
start
byte field type of
data Description and requirements
0 Server IP
address length BYTE length n
1 server IP
address STRING Real-time audio and video server IP address
1 + n
Server audio
and video
channel (TCP)
WORD Real-time audio and video server port number, Set
to 0 when not using TCP transmission
3 + n
Server audio
and video
channel (UDP)
WORD Real-time audio and video server port number, Set
to 0 when not using UDP transmission
5 + n logical channel
number BYTE According to Table 2 in JT/T 1076-2016
6 + n Audio and
video type BYTE 0: audio and video, 1: audio, 2: video, 3: video or
audio&video
7 + n stream type BYTE
0: main stream or sub stream, 1: main stream, 2:
sub stream; If this channel only transmits audio,
this field is set to 0
8 + n memory type BYTE 0: main storage or disaster recovery storage, 1:
main storage, 2: disaster recovery storage
9 + n playback
method BYTE
0: normal playback;
1: fast forward playback;
2: Key frame rewind playback;
3: Key frame playback;
4: Single frame upload
10 +
n
Fast forward or
rewind
multiples
BYTE
When the playback mode is 1 and 2, the content of
this field is valid, otherwise set to 0.
0: invalid;
1: 1 times;
2: 2 times
10 +
n
Fast forward or
rewind
multiples
BYTE
3: 4 times;
4: 8 times;
5: 16 times
11 +
n Start time BCD[6]
YY-MM-DD-HH-MM-SS, if playback mode is 4, then
this field indicates the upload time of a single
frame
17 +
n End Time BCD[6]
YY-MM-DD-HH-MM-SS, if it is 0, it means always
playback, when the playback mode is 4, this field is
invalidiMettaX.com
start
byte field
type
of
data
Description and requirements
0 Audio and video
channel number BYTE According to Table 2 in JT/T 1076-2016
1 playback control BYTE
0: start playback;
1: Pause playback;
2: End playback;
3: fast forward
4: Key frame rewind playback;
5: Drag and playback;
6: Key frame playback
2 Fast forward or
rewind multiples BYTE
When the playback control is 3 and 4, the content
of this field is valid, otherwise set to 0.
0: invalid;
1: 1 times;
2: 2 times;
3: 4 times;
4: 8 times;
5: 16 times
3 drag playback
position BCD[6] YY-MM-DD-HH-MM-SS, when playback control is
5, This field is valid
5. 6. 4 The platform issues remote video playback control
Message ID: 0x9202.
Message type: signaling data message.
During the audio and video playback process of the terminal device, the platform can issue
playback control commands to control the playback process.
See Table 25 for the data format.
Table 25 Remote video playback control data format issued by the platform
5. 6. 5 File upload command
Message ID: 0x9206.
Message type: signaling data message.
The platform issues a file upload command to the terminal, and the terminal replies with a
general response and uploads the file to the target FTP server with a specified path. The message
body data format is shown in Table 26.
Table 26 File upload instruction data formatiMettaX.com
start
byte field type of
data Description and requirements
0 server address
length BYTE length k
1 server address STRING FTP server address
1+k port WORD FTP server port number
3+k username
length BYTE length l
4+k username STRING FTP username
4 + k + l password
length BYTE Length m
5 + k + l password STRING FTP password
5 + k + l
+ m
file upload path
length BYTE length n
6 + k + l
+ m file upload path STRING file upload path
6 + k + l
+ m + n
logical channel
number BYTE See Table 2 in JT/T 1076-2016
7 + k + l
+ m + n start time BCD[6] YY-MM-DD-HH-MM-SS
13 + k +
l + m +
n
end time BCD[6] YY-MM-DD-HH-MM-SS
19 + k +
l + m +
n
Alarm flag 64 BITS
bit0 ~ bit31 see JT/T 808-2011 Table 18 Alarm
flag definition;
See Table 12 for bit32 ~ bit63;
All 0 means do not specify whether there is an
alarm
27 + k +
l + m +
n
audio and
video resource
type
BYTE 0: audio and video, 1: audio, 2: video, 3: video or
audio
28 + k +
l + m +
n
stream type BYTE 0: main stream or sub stream, 1: main stream,
2: sub stream
29 + k +
l + m +
n
storage
location BYTE 0: main storage or disaster recovery storage, 1:
main storage, 2: disaster recovery storageiMettaX.com
start
byte field type of
data Description and requirements
30 + k +
l + m +
n
task execution
conditions BYTE
Expressed in bits:
bit0: WIFI, when it is 1, it means that it can be
downloaded under WI-FI;
bit1: LAN, when it is 1, it means that it can be
downloaded when LAN is connected;
bit2: 3G/4G, when it is 1, it means that it can be
download under 3G/4G connection.
start
byte field type of
data Description and requirements
0 Response serial
number WORD Corresponding to the serial number of the
platform file upload message
2 result BYTE 0: success;
1: failure
5. 6. 6 Notification of file upload completion
Message ID: 0x1206.
Message type: signaling data message.
When all files are uploaded through FTP, the terminal will report this command to notify the
platform. The message body data format is shown in Table 27.
Table 27 File upload completion notification data format
5. 6. 7 File upload control
Message ID: 0x9207.
Message type: signaling data message.
The platform notifies the terminal to suspend, continue or cancel all files being transferred. The
message body data format is shown in Table 28.
Table 28 File upload control data formatiMettaX.com
start
byte field type of
data Description and requirements
0 Response serial
number WORD Corresponding to the serial number of the
platform file upload message
2 upload control BYTE
0: pause;
1: continue;
2: cancel
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-
2016
1 direction BYTE
0: stop;
1: up;
2: down;
3: left;
4: Right
2 speed BYTE 0 ~ 255
5. 7 PTZ control command
5. 7. 1 PTZ rotation
Message ID: 0x9301.
Message type: signaling data message.
The platform requests the terminal to rotate the camera. The message body data format is shown
in Table 29.
Table 29 PTZ rotation data format
5. 7. 2 PTZ adjustment focus control
Message ID: 0x9302.
Message type: signaling data message.
The platform requests the terminal to adjust the focal length of the lens. The message body data
format is shown in Table 30.
Table 30 The data format of pan/tilt adjustment lens focal length controliMettaX.com
start
byte field type of
data Description and requirements
0 logical channel number BYTE According to Table 2 in JT/T 1076-
2016
1 focal adjustment
direction BYTE 0: increase the focal length;
1: Reduce the focal length
start
byte field type of
data Description and requirements
0 logical channel number BYTE According to Table 2 in JT/T 1076-
2016
1 Aperture adjustment
method BYTE 0: turn up;
1: turn down
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-
2016
1 Start and stop flag BYTE 0: stop;
1: start
5. 7. 3 PTZ adjustment aperture control
Message ID: 0x9303.
Message type: signaling data message.
The platform requests the terminal to adjust the lens aperture. The message body data format is
shown in Table 31.
Table 31 Data format of pan/tilt adjustment lens aperture control
5. 7. 4 PTZ wiper control
Message ID: 0x9304.
Message type: signaling data message.
The platform requests to control the wiper of the terminal. The message body data format is
shown in Table 32.
Table 32 PTZ wiper control data formatiMettaX.com
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-
2016
1 Start and stop flag BYTE 0: stop;
1: start
start
byte field type of
data Description and requirements
0 logical channel
number BYTE According to Table 2 in JT/T 1076-
2016
1 Zoom control BYTE 0: zoom in;
1: zoom out
5. 7. 5 Infrared fill light control
Message ID: 0x9305.
Message type: signaling data message.
The platform requests the infrared fill light control from the terminal. The message body data
format is shown in Table 33.
Table 33 Infrared fill light control data format
5. 7. 6 PTZ zoom control
Message ID: 0x9306.
Message type: signaling data message.
The platform requests zoom control of the terminal. The message body data format is shown in
Table 34.
Table 34 PTZ zoom control data format
5. 8 Terminal sleep wake-up command
The platform wakes up the dormant terminal to start working by sending a wake-up message. The
content of the message is "WAKEUPXX", where XX represents the wake-up time, the unit is minute
(min), and the value range is 0-65536. If it is 0, it means that it has been in the wake-up state until
the terminal ACC ON or lower than rated voltage.iMettaX.com
6 Code stream communication between audio and
video stream server and client player software
6. 1 Audio and video stream and transparent data
encapsulation format
See Table 18 for the definition of audio and video streams and transparent data encapsulation
formats between the video platform and the client playback software.
6. 2 Audio and video stream request URL instruction format
The government video monitoring platform sends a real-time preview or remote playback request
command to the enterprise video monitoring platform and obtains the IP address and port
number of the audio and video streaming server after receiving a successful response. The client
of the government video monitoring platform directly sends the URL command to the enterprise
audio and video streaming server. After the link is established, the audio and video streaming
data is obtained.
request URL should not be displayed in the user interface, and the instruction format is defined
as follows: http:// [server IP address]: [port number] / [license plate number]. [License plate color].
[Logical channel number]. [Audio and video logo]. [Time-limited password]
See Table 35 for the definition of each data item of the audio and video stream request URL
command.
Table 35 Audio and video stream request URL instruction data item definition tableiMettaX.com
field Description and requirements
Address
attribute
information
Server IP
address Audio and video streaming
The port
number Audio and video streaming service port number
License plate
number
UTF-8 encoding should be adopted, and uniformly
transformed into application/x- in IETF RFC 2854 www-
form-URLencoded MIME format
license plate
color According to JT/T 415-2006 5.4.12 regulations
logical
channel
number
According to Table 2 in JT/T 1076-2016, 0 means all
channels
audio and
video flag 0: audio and video; 1:audio; 2: video
Additional
Information
time-limited
password
Generated by the server of the enterprise platform, the
time-limited password of the client of the regional
government platform is different from the time-limited
password of the cross-domain regional government
platform. The Time-limited password should only consist
of English letters (including uppercase and lowercase) and
Arabic numerals, with a length of 64 ASCII characters, and
should be updated every 24h.
location
identification
The satellite positioning time and latitude and longitude of
the vehicle at any time within 5 minutes are used for
verification when accessing the cross-domain regional
government platform, and the client access of the regional
government platform can be empty. ASCII character
representation, the format is: YYYYMMDD-HHMMSS-
NXX.XXXXXX-EXXX.XXXXXX
7 Communication protocol basis between video
platforms
The communication methods, data types, security authentication methods and protocol message
formats between different video platforms are in accordance with the requirements of Chapter 4
of JT/T 809-2011.
The data transmission between different video platforms does not need to be authenticated, and
the transmission channel should use the links that have been established between the
positioning platforms, and no new links will be added.iMettaX.com
8 Communication protocol flow between video
platforms
8. 1 Time-limited password report and request business class
The time-limited password is automatically generated by the enterprise video surveillance
platform every day, and is actively uploaded to the video supervision platform of the local
government. When the cross-domain regional government video supervision platform needs to
access the audio and video information of cross-domain vehicles, it should request the cross-
domain time-limited password of the day to the higher-level government video supervision
platform.
8. 2 Real-time audio and video services
8. 2. 1 The enterprise video monitoring platform uploads audio and video
data to the government video monitoring platform in real time
The government video monitoring platform sends a real-time audio and video upload request to
the enterprise video monitoring platform. After receiving the request, the enterprise video
monitoring platform should respond to the government video monitoring platform. If the
answer is successful, the government video monitoring platform will request real-time audio and
video data from the video server IP and port specified by the enterprise video monitoring
platform.
8. 2. 2 Enterprise video surveillance platforms stop uploading audio and
video data to government video surveillance platforms in real time
The government video surveillance platform sends a request to stop real-time audio and video
uploads to the enterprise video surveillance platform. After receiving the request, the enterprise
video surveillance platform should respond to the government video surveillance platform. If the
answer is successful, the enterprise video monitoring platform stops sending real-time audio and
video data to the government video monitoring platform.
8. 3 Remote Video Retrieval Service
8. 3. 1 The government video monitoring platform obtains the audio and
video resource catalog from the enterprise video monitoring platform
The government video monitoring platform sends a request to the enterprise video monitoring
platform to obtain the audio and video resource directory. After receiving the request, the
enterprise video monitoring platform should immediately retrieve the latest audio and video
resource directory from the terminal, update the local directory, and respond to the government
video monitoring platform. If the answer is successful, the enterprise video monitoring platform
sends the audio and video resource directory data to the government video monitoring platform.iMettaX.com
8. 3. 2 The enterprise video monitoring platform actively uploads the
audio and video resource catalog to the government video monitoring
platform
After the enterprise video monitoring platform receives the special alarm information uploaded
by the terminal, after waiting for the complete record of the video information, it should retrieve
the latest audio and video resource directory with the special alarm logo from the terminal,
update the local directory, and then actively upload the audio and video resource directory to the
government video monitoring platform.
8. 4 Remote video download business
8. 4. 1 The government video monitoring platform downloads video data
to the enterprise video monitoring platform
The government video monitoring platform sends a request to obtain video data to the enterprise
video monitoring platform. After receiving the request, the enterprise video monitoring platform
should respond to the government video monitoring platform. If the answer is successful, the
government video surveillance platform can request video recording data from the FTP server IP
and port specified by the enterprise video surveillance platform.
8. 4. 2 The enterprise video monitoring platform sends a download
completion notification to the government video monitoring platform
The enterprise video monitoring platform sends a download completion notification to the
government video monitoring platform. After receiving the notification, the government video
monitoring platform indicates that the video data has been downloaded from the terminal. The
government video monitoring platform can send the video FTP server IP and port specified by the
enterprise video monitoring platform Request recording data.
8. 4. 3 The government video monitoring platform sends download
control instructions to the enterprise video monitoring platform
The government video monitoring platform sends download control instructions to the
enterprise video monitoring platform. After receiving the instruction, the enterprise video
monitoring platform should respond to the corresponding control actions in a timely manner and
give the answer to the government video monitoring platform.
8. 5 Remote video playback business
8. 5. 1. The government video monitoring platform requests video
playback from the enterprise video monitoring platform
The government video monitoring platform sends a video playback request to the enterprise
video monitoring platform, and the enterprise video monitoring platform should respond to the
government video monitoring platform after receiving the request. If the answer is successful, the
government video monitoring platform will request historical audio and video streaming data
from the IP and port of the audio and video streaming server designated by the enterprise video
monitoring platform.iMettaX.com
8. 5. 2 The government video monitoring platform stops requesting video
playback from the enterprise video monitoring platform
The government video monitoring platform sends a request to the enterprise video monitoring
platform to stop playback of videos. After receiving the request, the enterprise video monitoring
platform should respond to the government video monitoring platform and stop sending
historical audio and video stream data to the government video monitoring platform.
9 Definition of communication protocol constants
between video platforms
9. 1 Service data type identification
See Table 36 for the Service datatype name and identification specified in the audio and video
data exchange protocol.
Table 36 Service data type name and identification comparison tableiMettaX.com
Message
Type
Service data Type
Name
message
link
Service data type
identification value
Time-limited
password
service
Master link Time-
limited password
interaction
message
Master
link UP_AUTHORIZE_MSG 0x1700
Time-limited
password
service
Slave link Time-
limited password
interaction
message
Slave link DOWN_AUTHORIZE_MSG 0x9700
Real-time
audio and
video service
Master link real-
time audio and
video interaction
message
Master
link UP_REALVIDEO_MSG 0x1800
Real-time
audio and
video service
Slave link real-time
audio and video
interaction
message
Slave link DOWN_REALVIDEO_MSG 0x9800
Remote
Video
Retrieval
Master link remote
video retrieval
interaction
message
Master
link UP_SEARCH_MSG 0x1900
Remote
Video
Retrieval
Slave link remote
video retrieval
interaction
message
Slave link DOWN_SEARCH_MSG 0x9900
Remote
video
playback
Master link remote
video playback
interaction
message
Master
link UP_PLAYBACK_MSG 0x1A00
Remote
video
playback
Slave link remote
video playback
interaction
message
Slave link DOWN_PLAYBACK_MSG 0x9A00
Remote
video
download
Master link remote
video download
interaction
message
Master
link UP_DOWNLOAD_MSG 0x1B00
Remote
video
download
Slave link remote
video playback
interaction
message
Slave link DOWN_DOWNLOAD_MSG 0x9B00iMettaX.com
9. 2 Identification of sub-service types
See Table 37 for the name and identification of sub-service types specified in the data exchange
protocol.
Table 37 Sub-service type name and identification comparison tableiMettaX.com
Service datatype Sub-service type
name Sub-service data type identification value
Master link Time-limited
password service class
message
UP_AUTHORIZE_MSG
Time-limited password
report message UP_AUTHORIZE_MSG_STARTUP 0x1701
UP_AUTHORIZE_MSG Time-limited password
request message UP_AUTHORIZE_MSG_STARTUP_REQ 0x1702
Slave link Time-limited
password service class
Message
DOWN_BASE_DATA_MSG
Time-limited Password
Request Response
Message
DOWN_AUTHORIZE_MSG_STARTUP_REQ_ACK 0x9702
Master link real-time audio
and video interaction
Message
UP_REALVIDEO_MSG
request to startup real-
time transmission ACK UP_REALVIDEO_MSG_STARTUP_ACK 0x1801
UP_REALVIDEO_MSG request to end real-
time transmission ACK UP_REALVIDEO_MSG_END_ACK 0x1802
Slave link real-time audio
and video interaction
Message
DOWN_REALVIDEO_MSG
request to startup real-
time transmission DOWN_REALVIDEO_MSG_STARTUP 0x9801
DOWN_REALVIDEO_MSG request to end real-
time transmission DOWN_REALVIDEO_MSG_END 0x9802
Master link remote record
search interaction
Message UP_SEARCH_MSG
upload audio and
video resource list UP_FILELIST_MSG 0x1901
UP_SEARCH_MSG Query audio and video
resource list ACK UP_REALVIDEO_FILELIST_REQ_ACK 0x1902
Slave link remote record
search interaction
Message
DOWN_SEARCH_MSG
upload audio and
video resource list ACK DOWN_FILELIST_MSG_ACK 0x9901
DOWN_SEARCH_MSG Query audio and video
resource list DOWN_REALVIDEO_FILELIST_REQ 0x9902
Master link remote video
playback interaction
message UP_PLAYBACK_MSG
remote video playback
ACK UP_PLAYBACK_MSG_STARTUP_ACK 0x1A01
UP_PLAYBACK_MSG remote video playback
control ACK UP_PLAYBACK_MSG_CONTROL_ACK 0x1A02
Slave link remote video
playback interaction
message
DOWN_PLAYBACK_MSG
remote video playback DOWN_PLAYBACK_MSG_STARTUP 0x9A01
DOWN_PLAYBACK_MSG remote video playback
control DOWN_PLAYBACK_MSG_CONTROL 0x9A02
Master link remote video
download interaction
message
UP_DOWNLOAD_MSG
remote video
download ACK UP_DOWNLOAD_MSG_STARTUP_ACK 0x1B01
UP_DOWNLOAD_MSG
remote video
download END
INFORM
UP_DOWNLOAD_MSG_END_INFORM 0x1B02iMettaX.com
Service datatype Sub-service type
name Sub-service data type identification value
UP_DOWNLOAD_MSG remote video
download control ACK UP_DOWNLOAD_MSG_CONTROL_ACK 0x1B03
Slave link remote video
download interaction
message
DOWN_DOWNLOAD_MSG
remote video
download DOWN_DOWNLOAD_MSG_STARTUP 0x9B01
DOWN_DOWNLOAD_MSG
remote video
download END
INFORM ACK
UP_DOWNLOAD_MSG_END_INFORM_ACK 0x9B02
DOWN_DOWNLOAD_MSG remote video
download control DOWN_DOWNLOAD_MSG_CONTROL 0x9B03
the
code name Description and
requirements
0x0101 Video signal loss alarm
0x0102 Video signal blocking alarm
0x0103 Storage unit failure alarm
0x0104 Other video equipment failure alarm
0x0105 Bus overcrowding alarm
0x0106 Abnormal driving behavior alarm
0x0107 Special alarm recording reaches the storage
threshold alarm
9. 3 Video alarm type coding
See Table 38 for the coding of video alarm types reported through the platform.
Table 38 Coding list of vehicle video alarm types
Appendix A
(Normative appendix)
Message comparison table between video terminal and video platform
Table A. 1 Message comparison table between video terminal and video platformiMettaX.com
serial
number message body name message
ID
1 Query the audio and video properties of the terminal 0x9003
2 Terminal upload audio and video attributes 0x1003
3 Real-time audio and video transmission request 0x9101
4 Terminal upload passenger flow 0x1005
5 Audio and video real-time transmission control 0x9102
6 Real-time audio and video streaming and transparent data
transmission
7 Real-time audio and video transmission status notification 0x9105
8 Query resource list 0x9205
9 Terminal upload audio and video resource list 0x1205
10 The platform sends a remote video playback request 0x9201
11 The platform issues remote video playback control 0x9202
12 File upload command 0x9206
13 Notification of file upload completion 0x1206
14 File upload control 0x9207
15 PTZ rotation 0x9301
16 PTZ adjustment focus control 0x9302
17 PTZ adjustment aperture control 0x9303
18 PTZ wiper control 0x9304
19 Infrared fill light control 0x9305
20 PTZ zoom control 0x9306
21 Platform manual wakeup request (short message) WAKEUPXXiMettaX.com