# chat21-http-server

Chat21 native REST API server


== Send a Message ==

curl --location --request POST 'http://localhost:8004/api/tilechat/messages' \
--header 'Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMGI4ZGFiMi00YzMzLTQzMTMtYTIzZS01ZDMxN2MwYWJmOTEiLCJzdWIiOiI2ZDAxMW42MmlyMDk3YzAxNDNjYzQyZGMiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjZkMDExbjYyaXIwOTdjMDE0M2NjNDJkYy4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNmQwMTFuNjJpcjA5N2MwMTQzY2M0MmRjLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNmQwMTFuNjJpcjA5N2MwMTQzY2M0MmRjIiwiY2lkIjoiNmQwMTFuNjJpcjA5N2MwMTQzY2M0MmRjIiwiYXpwIjoiNmQwMTFuNjJpcjA5N2MwMTQzY2M0MmRjIiwidXNlcl9pZCI6IjZkMDExbjYyaXIwOTdjMDE0M2NjNDJkYyIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE4OTg4ODQ4LCJleHAiOjE5MzAwMjg4NDgsImF1ZCI6WyJyYWJiaXRtcSIsIjZkMDExbjYyaXIwOTdjMDE0M2NjNDJkYyJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.JRH9JleyzvTCgcM-Hd62bml10TSe9lEWG5Pv19-AxHY' \
--header 'Content-Type: application/json' \
--data-raw '{
 "sender_id": "04-ANDREASPONZIELLO",
 "sender_fullname": "Andrea Sponziello",
 "recipient_id": "03-ANDREALEO",
    "recipient_fullname": "Andrea Leo",
    "text": "hello",
    "type": "text",
    "channel_type": "direct"
}'