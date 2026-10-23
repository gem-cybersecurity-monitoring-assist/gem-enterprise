# Actual-host gate verification

2026-10-12: Windows diagnostics reported virtualCameraActive=true. The focused actual Edge page check returned OBS_GATE={gate:true,camera:Running}. JavaScript syntax and esbuild passed.

The broader scene/profile regression did not pass this run: one attempt failed a profile persistence assertion after reload; the second failed scene/voice preference restoration after reload, with leftover duplicate synthetic test profiles. Those broad results are not represented as passing. Earlier successful runs do not override this result. The focused OBS test avoids profile/scene mutation and independently verifies the requested automatic display.

Full-body rendering, actual transformed-video bridge and external processed-voice call routing remain incomplete. Automatic camera readiness does not establish full-call readiness. No green status is assigned to unavailable transformed output.
