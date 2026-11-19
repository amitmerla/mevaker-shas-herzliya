// Reads every document's text layer (PDFKit) and prints JSON: [{id, page, text}]. Used by tools/build-corpus.sh.
// Scanned pages and images have no text layer (macOS OCR has no Hebrew), so they come back empty and the builder reports them.
import PDFKit; import Foundation
let root = CommandLine.arguments[1]
let input = try! JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [[String: Any]]
var out: [[String: Any]] = []
for d in input {
  guard let id = d["id"] as? String, let file = d["file"] as? String, file.lowercased().hasSuffix(".pdf"),
        let doc = PDFDocument(url: URL(fileURLWithPath: root + "/" + file)) else { continue }
  for i in 0..<doc.pageCount {
    let t = (doc.page(at: i)?.string ?? "").replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    out.append(["id": id, "page": i + 1, "text": t])
  }
}
FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: out))
