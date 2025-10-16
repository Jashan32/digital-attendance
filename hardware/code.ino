#include <Wire.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>
#include "SPIFFS.h"
#include <HardwareSerial.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>

#define BUTTON_PIN 4
#define LONG_PRESS_TIME 1000

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------- WiFi Config ----------------
const char* ssid = "DAC LAB";
const char* password = "DAC@2024";

// ---------------- R307S Pins ----------------
#define RX_PIN 16
#define TX_PIN 17
#define UART_NUM 2

HardwareSerial fingerSerial(UART_NUM);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

// ---------------- SPIFFS ----------------
const char* MAPPING_PATH = "/fingerprints.json";
uint16_t nextId = 1;
DynamicJsonDocument mappingDoc(4096);

// ---------------- prototypes ----------------
void loadMapping();
void saveMapping();
uint16_t enrollFingerprint();
uint16_t identifyFingerprint();
bool postFingerprintId(uint16_t id);
String fingerErrorStr(uint8_t p);
void printStatus(uint8_t p);
void resetAllFingerprints();
void menuLoop();
void showAndLog(const String& l1, const String& l2, unsigned long ms = 1500);

// ---------------- helper ----------------
void showAndLog(const String& l1, const String& l2, unsigned long ms) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(l1);
  lcd.setCursor(0, 1);
  lcd.print(l2);
  Serial.print("[LCD] ");
  Serial.print(l1);
  Serial.print(" | ");
  Serial.println(l2);
  if (ms) delay(ms);
}

String fingerErrorStr(uint8_t p) {
  switch (p) {
    case FINGERPRINT_OK: return "OK";
    case FINGERPRINT_NOFINGER: return "No finger";
    case FINGERPRINT_PACKETRECIEVEERR: return "Comm error";
    case FINGERPRINT_IMAGEFAIL: return "Image fail";
    case FINGERPRINT_IMAGEMESS: return "Image messy";
    case FINGERPRINT_FEATUREFAIL: return "Feature fail";
    case FINGERPRINT_NOMATCH: return "No match";
    case FINGERPRINT_INVALIDIMAGE: return "Invalid image";
    default: return "Err " + String(p);
  }
}

// ---------------- SPIFFS ----------------
void loadMapping() {
  if (!SPIFFS.exists(MAPPING_PATH)) {
    mappingDoc.clear();
    mappingDoc["nextId"] = nextId;
    mappingDoc["fingerprints"] = JsonArray();
    File f = SPIFFS.open(MAPPING_PATH, FILE_WRITE);
    if (f) {
      serializeJson(mappingDoc, f);
      f.close();
    }
    Serial.println("[SPIFFS] Created new mapping file");
    return;
  }

  File f = SPIFFS.open(MAPPING_PATH, FILE_READ);
  if (!f) {
    Serial.println("[SPIFFS] Open failed");
    return;
  }

  DeserializationError err = deserializeJson(mappingDoc, f);
  f.close();
  if (err) {
    Serial.println("[SPIFFS] JSON parse error");
    return;
  }

  if (mappingDoc.containsKey("nextId")) nextId = mappingDoc["nextId"];
  Serial.printf("[SPIFFS] Loaded (nextId=%d)\n", nextId);
}

void saveMapping() {
  mappingDoc["nextId"] = nextId;
  File f = SPIFFS.open(MAPPING_PATH, FILE_WRITE);
  if (!f) {
    Serial.println("[SPIFFS] Write failed");
    return;
  }
  serializeJson(mappingDoc, f);
  f.close();
  Serial.println("[SPIFFS] Mapping saved");
}

// ---------------- ENROLL ----------------
uint16_t enrollFingerprint() {
  Serial.println("[ENROLL] Start");
  showAndLog("Enroll Mode", "Place finger", 500);

  uint8_t p;

  // -------- First Scan --------
  while (true) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) break;
    if (p == FINGERPRINT_NOFINGER) {
      if (digitalRead(BUTTON_PIN) == LOW) {
        showAndLog("Enroll", "Aborted", 800);
        return 0;
      }
      delay(200);
      continue;
    }
    showAndLog("Scan error", fingerErrorStr(p), 1200);
    return 0;
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    showAndLog("Feature fail", fingerErrorStr(p), 1200);
    return 0;
  }

  // Wait for removal
  showAndLog("Remove finger", "", 800);
  Serial.println("[ENROLL] Waiting for finger removal...");
  while (finger.getImage() != FINGERPRINT_NOFINGER) delay(200);

  // -------- Second Scan --------
  showAndLog("Place again", "same finger", 800);
  Serial.println("[ENROLL] Waiting for second placement...");

  while (true) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) break;
    if (p == FINGERPRINT_NOFINGER) {
      if (digitalRead(BUTTON_PIN) == LOW) {
        showAndLog("Enroll", "Aborted", 800);
        return 0;
      }
      delay(200);
      continue;
    }
    showAndLog("Scan error", fingerErrorStr(p), 1200);
    return 0;
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    showAndLog("Feature fail", fingerErrorStr(p), 1200);
    return 0;
  }

  // -------- Create Model --------
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    showAndLog("Model fail", fingerErrorStr(p), 1200);
    return 0;
  }

  uint16_t idToStore = nextId;
  p = finger.storeModel(idToStore);
  if (p != FINGERPRINT_OK) {
    showAndLog("Store fail", fingerErrorStr(p), 1200);
    return 0;
  }

  // Update mapping
  JsonArray arr = mappingDoc["fingerprints"].as<JsonArray>();
  if (!arr) mappingDoc["fingerprints"] = JsonArray();
  arr = mappingDoc["fingerprints"].as<JsonArray>();
  JsonObject obj = arr.createNestedObject();
  obj["fingerprint"] = idToStore;
  obj["meta"] = "created " + String(millis());
  nextId++;
  saveMapping();

  showAndLog("Enroll success", "ID: " + String(idToStore), 1500);
  Serial.printf("[ENROLL] Success ID=%d\n", idToStore);
  return idToStore;
}

// ---------------- IDENTIFY ----------------
uint16_t identifyFingerprint() {
  Serial.println("[IDENTIFY] Start");
  showAndLog("Scan finger", "", 500);

  uint8_t p;
  while (true) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) break;
    if (p == FINGERPRINT_NOFINGER) {
      if (digitalRead(BUTTON_PIN) == LOW) {
        showAndLog("Identify", "Aborted", 800);
        return 0;
      }
      delay(200);
      continue;
    }
    showAndLog("Scan error", fingerErrorStr(p), 1000);
    return 0;
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    showAndLog("Feature fail", fingerErrorStr(p), 1000);
    return 0;
  }

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    showAndLog("Found ID:", String(finger.fingerID), 1200);
    Serial.printf("[IDENTIFY] Found ID=%d conf=%d\n", finger.fingerID, finger.confidence);
    return finger.fingerID;
  } else if (p == FINGERPRINT_NOMATCH) {
    showAndLog("No match", "", 800);
    return 0;
  } else {
    showAndLog("Search fail", fingerErrorStr(p), 1000);
    return 0;
  }
}

// ---------------- RESET ----------------
void resetAllFingerprints() {
  Serial.println("[RESET] Start");
  showAndLog("Resetting...", "", 500);
  uint8_t p = finger.emptyDatabase();
  if (p == FINGERPRINT_OK) Serial.println("[RESET] Sensor DB cleared");
  else {
    showAndLog("Sensor error", fingerErrorStr(p), 1500);
    return;
  }

  if (SPIFFS.exists(MAPPING_PATH)) SPIFFS.remove(MAPPING_PATH);

  mappingDoc.clear();
  mappingDoc["nextId"] = 1;
  mappingDoc["fingerprints"] = JsonArray();
  nextId = 1;
  saveMapping();
  showAndLog("All cleared!", "", 1000);
}

// ---------------- POST ----------------
bool postFingerprintId(uint16_t id) {
  if (WiFi.status() != WL_CONNECTED) {
    showAndLog("No WiFi", "Cannot POST", 1000);
    return false;
  }

  const char* serverUrl = "http://192.168.1.116:3003/attendance/scan";
  HTTPClient http;
  WiFiClient client;
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");

  String timestamp = "2025-10-13T08:10:00.000Z";
  String payload = "{\"fingerId\":" + String(id) + ",\"timestamp\":\"" + timestamp + "\",\"currentDateTime\":\"" + timestamp + "\"}";
  Serial.println("[HTTP] Payload: " + payload);

  int httpCode = http.POST(payload);
  String resp = http.getString();
  http.end();

  Serial.printf("[HTTP] Code=%d\n", httpCode);
  Serial.println(resp);

  bool success = false;

  switch (httpCode) {
    case 401:
      showAndLog("Invalid Parameters", "", 1000);
      break;

    case 402:
      showAndLog("Invalid timestamp", "format", 1000);
      break;

    case 403:
      showAndLog("Invalid time", "format", 1000);
      break;

    case 404:
      showAndLog("Student ID", "not found", 1000);
      break;

    case 405:
      showAndLog("Student account", "is inactive", 1000);
      break;

    case 406:
      showAndLog("No active", "timetable found", 1000);
      break;

    case 407:
      showAndLog("No classes scheduled", "for today", 1000);
      break;

    case 408:
      showAndLog("No classes scheduled", "for current time", 1000);
      break;

    case 409:
      showAndLog("Attendance", "already marked", 1000);
      break;

    case 200:
      showAndLog("Attendance", "Marked", 1000);
      success = true;
      break;

    case 201:
      showAndLog("Attendance not marked", "LATE Entry", 1000);
      success = true;
      break;

    default:
      showAndLog("HTTP Error", "Code: " + String(httpCode), 1000);
      break;
  }


  return success;
}

// ---------------- MENU ----------------
void menuLoop() {
  const char menuItems[4] = { 'A', 'E', 'S', 'R' };
  int current = 0;
  int previous = -1;  // store previous index for comparison

  while (true) {
    // Update display only when menu item changes
    if (current != previous) {
      lcd.clear();
      lcd.print("Select: ");
      lcd.print(menuItems[current]);
      Serial.printf("[MENU] Hover: %c\n", menuItems[current]);
      previous = current;
    }

    // Button handling
    if (digitalRead(BUTTON_PIN) == LOW) {
      unsigned long start = millis();
      while (digitalRead(BUTTON_PIN) == LOW)
        ;
      unsigned long press = millis() - start;

      if (press > LONG_PRESS_TIME) {
        char choice = menuItems[current];
        showAndLog("Selected:", String(choice), 600);
        Serial.printf("[MENU] Selected %c\n", choice);

        // ----------- A: Attendance -----------
        if (choice == 'A') {
          showAndLog("Attendance", "Long press exit", 800);
          while (true) {
            uint16_t id = identifyFingerprint();
            if (id) postFingerprintId(id);
            if (digitalRead(BUTTON_PIN) == LOW) {
              unsigned long s2 = millis();
              while (digitalRead(BUTTON_PIN) == LOW)
                ;
              if (millis() - s2 > LONG_PRESS_TIME) {
                showAndLog("Exit", "Attendance", 800);
                break;
              }
            }
          }
        }

        // ----------- E: Enroll -----------
        else if (choice == 'E') {
          showAndLog("Enroll", "Long press exit", 800);
          while (true) {
            uint16_t id = enrollFingerprint();
            if (id) Serial.printf("[ENROLL] Stored ID=%d\n", id);
            if (digitalRead(BUTTON_PIN) == LOW) {
              unsigned long s2 = millis();
              while (digitalRead(BUTTON_PIN) == LOW)
                ;
              if (millis() - s2 > LONG_PRESS_TIME) {
                showAndLog("Exit", "Enroll", 800);
                break;
              }
            }
          }
        }

        // ----------- S: Search -----------
        else if (choice == 'S') {
          showAndLog("Search", "Long press exit", 800);
          while (true) {
            identifyFingerprint();
            if (digitalRead(BUTTON_PIN) == LOW) {
              unsigned long s2 = millis();
              while (digitalRead(BUTTON_PIN) == LOW)
                ;
              if (millis() - s2 > LONG_PRESS_TIME) {
                showAndLog("Exit", "Search", 800);
                break;
              }
            }
          }
        }

        // ----------- R: Reset both local and DB -----------
        else if (choice == 'R') {
          showAndLog("Reset mode", "Hold to confirm", 1000);
          unsigned long t0 = millis();
          bool confirmed = false;
          while (millis() - t0 < 8000) {
            if (digitalRead(BUTTON_PIN) == LOW) {
              unsigned long s2 = millis();
              while (digitalRead(BUTTON_PIN) == LOW)
                ;
              if (millis() - s2 > LONG_PRESS_TIME) {
                confirmed = true;
                break;
              }
            }
          }
          if (confirmed) {
            resetAllFingerprints();
            const char* serverUrl = "http://192.168.1.116:3003/student/delete-all?confirm=DELETE_ALL_STUDENT_DATA";
            HTTPClient http;
            WiFiClient client;
            http.begin(client, serverUrl);
            http.addHeader("Content-Type", "application/json");

            int httpCode = http.sendRequest("DELETE");
            String resp = http.getString();
            http.end();

            Serial.printf("[HTTP] Code=%d\n", httpCode);
            Serial.println(resp);
            if (httpCode == 200) {
              showAndLog("All students", "data deleted", 800);
            }
          }
            else { showAndLog("Cancelled", "", 800); };
        }

        // Force refresh on return
        previous = -1;
      } else {
        // Short press → move to next menu item
        current = (current + 1) % 4;
        Serial.printf("[MENU] Next: %c\n", menuItems[current]);
      }
    }

    delay(50);  // small debounce delay
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  showAndLog("Booting...", "", 500);

  // ---------- Wi-Fi Connection ----------
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.printf("[WiFi] Connecting to %s\n", ssid);

  unsigned long lastPrint = 0;
  int dotCount = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);

    // Print progress dots in Serial
    Serial.print(".");
    dotCount++;
    if (dotCount % 60 == 0) Serial.println();

    // Every few seconds, refresh LCD to show connection attempt
    if (millis() - lastPrint > 2000) {
      lcd.clear();
      lcd.print("Connecting WiFi");
      lcd.setCursor(0, 1);
      lcd.print(".");
      for (int i = 0; i < (dotCount % 6); i++) lcd.print(".");
      lastPrint = millis();
    }
  }

  Serial.println();
  showAndLog("WiFi OK", WiFi.SSID(), 800);
  Serial.printf("[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());

  // ---------- SPIFFS ----------
  if (!SPIFFS.begin(true)) {
    Serial.println("[SPIFFS] Mount failed");
    showAndLog("SPIFFS Error", "", 0);
    while (1) delay(1000);
  }

  // ---------- Fingerprint Sensor ----------
  fingerSerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);
  if (finger.verifyPassword()) {
    showAndLog("Sensor Ready", "", 800);
    Serial.println("[SENSOR] Fingerprint sensor verified");
  } else {
    showAndLog("Sensor Error", "Check wiring", 0);
    Serial.println("[SENSOR] Fingerprint sensor not found");
    while (1) delay(1000);
  }

  // ---------- Load local fingerprint map ----------
  loadMapping();
  showAndLog("Ready", "Press button", 1000);
  Serial.println("[SYSTEM] Ready for menu navigation");

  // ---------- Start main menu ----------
  menuLoop();
}

void loop() {}
